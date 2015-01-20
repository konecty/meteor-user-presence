var allowedStatus = ['auto', 'away', 'busy', 'offline'];

UserPresence = {
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
		console.log('removeConnectionsByInstanceId', instanceId);
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
		console.log('removeAllConnections');
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

		console.log('createConnection', userId, connection.id);

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

		console.log('setConnection', userId, connection.id, status);

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

		console.log('setDefaultStatus', userId, status);

		Meteor.users.update({_id: userId, statusDefault: {$ne: status}}, {$set: {statusDefault: status}});
	},

	removeConnection: function(connectionId) {
		console.log('removeConnection', connectionId);

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
	}
}

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


Meteor.startup(function() {
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

	UserPresenceMonitor.start();

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
});