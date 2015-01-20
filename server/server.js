var allowedStatus = ['online', 'away', 'busy', 'offline'];

var logEnable = false;

var log = function(msg, color) {
	if (logEnable) {
		if (color) {
			console.log(msg[color]);
		} else {
			console.log(msg);
		}
	}
};

var logRed    = function() {log(Array.prototype.slice.call(arguments).join(' '), 'red');};
var logGray   = function() {log(Array.prototype.slice.call(arguments).join(' '), 'gray');};
var logGreen  = function() {log(Array.prototype.slice.call(arguments).join(' '), 'green');};
var logYellow = function() {log(Array.prototype.slice.call(arguments).join(' '), 'yellow');};

UserPresence = {
	activeLogs: function() {
		logEnable = true;
	},

	removeLostConnections: function() {
		if (Package['konecty:multiple-instances-status']) {
			var ids = InstanceStatus.getCollection().find({}, {fields: {_id: 1}}).fetch();

			ids = ids.map(function(id) {
				return id._id;
			});

			var update = {
				$pull: {
					connections: {
						instanceId: {
							$nin: ids
						}
					}
				}
			};

			UsersSessions.update({}, update, {multi: true});
		} else {
			UsersSessions.remove({});
		}
	},

	removeConnectionsByInstanceId: function(instanceId) {
		logRed('[user-presence] removeConnectionsByInstanceId', instanceId);
		var update = {
			$pull: {
				connections: {
					instanceId: instanceId
				}
			}
		};

		UsersSessions.update({}, update, {multi: true});
	},

	removeAllConnections: function() {
		logRed('[user-presence] removeAllConnections');
		UsersSessions.remove({});
	},

	startObserveForDeletedServers: function() {
		InstanceStatus.getCollection().find({}, {fields: {_id: 1}}).observeChanges({
			removed: function(id) {
				UserPresence.removeConnectionsByInstanceId(id);
			}
		});
	},

	createConnection: function(userId, connection) {
		if (!userId) {
			return;
		};

		logGreen('[user-presence] createConnection', userId, connection.id);

		var query = {
			_id: userId
		};

		var now = new Date();

		var instanceId = undefined;
		if (Package['konecty:multiple-instances-status']) {
			instanceId = InstanceStatus.id();
		};

		var update = {
			$push: {
				connections: {
					id: connection.id,
					instanceId: instanceId,
					status: 'online',
					_createdAt: now,
					_updatedAt: now
				}
			}
		};

		UsersSessions.upsert(query, update);
	},

	setConnection: function(userId, connection, status) {
		if (!userId) {
			return;
		};

		logGray('[user-presence] setConnection', userId, connection.id, status);

		var query = {
			_id: userId,
			'connections.id': connection.id
		};

		var now = new Date();

		var update = {
			$set: {
				'connections.$.status': status
			}
		};

		UsersSessions.upsert(query, update);
	},

	setDefaultStatus: function(userId, status) {
		if (!userId) {
			return;
		};

		if (allowedStatus.indexOf(status) === -1) {
			return;
		};

		logYellow('[user-presence] setDefaultStatus', userId, status);

		Meteor.users.update({_id: userId, statusDefault: {$ne: status}}, {$set: {statusDefault: status}});
	},

	removeConnection: function(connectionId) {
		logRed('[user-presence] removeConnection', connectionId);

		var query = {
			'connections.id': connectionId
		};

		var update = {
			$pull: {
				connections: {
					id: connectionId
				}
			}
		};

		UsersSessions.update(query, update);
	},

	start: function() {
		Meteor.onConnection(function(connection) {
			connection.onClose(function() {
				UserPresence.removeConnection(connection.id);
			});
		});

		process.on('exit', function() {
			if (Package['konecty:multiple-instances-status']) {
				UserPresence.removeConnectionsByInstanceId(InstanceStatus.id());
			} else {
				UserPresence.removeAllConnections();
			}
		});

		Accounts.onLogin(function(login) {
			UserPresence.createConnection(login.user._id, login.connection);
		});

		Meteor.publish(null, function() {
			if (this.userId == null) {
				UserPresence.removeConnection(this.connection.id);
			}
		});

		if (Package['konecty:multiple-instances-status']) {
			UserPresence.startObserveForDeletedServers();
		}

		UserPresence.removeLostConnections();

		Meteor.methods({
			'UserPresence:connect': function() {
				UserPresence.createConnection(this.userId, this.connection);
			},

			'UserPresence:away': function() {
				UserPresence.setConnection(this.userId, this.connection, 'away');
			},

			'UserPresence:online': function() {
				UserPresence.setConnection(this.userId, this.connection, 'online');
			},

			'UserPresence:setDefaultStatus': function(status) {
				UserPresence.setDefaultStatus(this.userId, status);
			}
		});
	}
}
