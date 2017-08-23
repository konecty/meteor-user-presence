/* globals InstanceStatus, UsersSessions, UserPresenceMonitor, UserPresence */

UsersSessions._ensureIndex({'connections.instanceId': 1}, {sparse: 1, name: 'connections.instanceId'});
UsersSessions._ensureIndex({'connections.id': 1}, {sparse: 1, name: 'connections.id'});

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

var logRed = function() {
	log(Array.prototype.slice.call(arguments).join(' '), 'red');
};
var logGrey = function() {
	log(Array.prototype.slice.call(arguments).join(' '), 'grey');
};
var logGreen = function() {
	log(Array.prototype.slice.call(arguments).join(' '), 'green');
};
var logYellow = function() {
	log(Array.prototype.slice.call(arguments).join(' '), 'yellow');
};

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

		// @TODO reprocessar status
	},

	removeConnectionsByInstanceId: function(instanceId) {
		logRed('[user-presence] removeConnectionsByInstanceId', instanceId);

		var userSessions = UsersSessions.find({ 'connections.instanceId': instanceId }).fetch();

		if (userSessions.length > 0) {
			var update = {
				$pull: {
					connections: {
						instanceId: instanceId
					}
				}
			};
			UsersSessions.update({ 'connections.instanceId': instanceId }, update, {multi: true});

			userSessions.forEach(function(userSession) {

				// remove instance connections to process the new user status
				userSession.connections = userSession.connections.filter(function(connection) {
					return connection.instanceId !== instanceId;
				});

				UserPresence.setStatusFromConnections(userSession._id, null, userSession);
			});
		}
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

	createConnection: function(userId, connection, status, metadata) {
		if (!userId) {
			return;
		}

		connection.UserPresenceUserId = userId;

		status = status || 'online';

		logGreen('[user-presence] createConnection', userId, connection.id, metadata);

		var query = {
			_id: userId
		};

		var now = new Date();

		var instanceId = undefined;
		if (Package['konecty:multiple-instances-status']) {
			instanceId = InstanceStatus.id();
		}

		var update = {
			$push: {
				connections: {
					id: connection.id,
					instanceId: instanceId,
					status: status,
					_createdAt: now,
					_updatedAt: now
				}
			}
		};

		if (metadata) {
			update.$set = {
				metadata: metadata
			};
			connection.metadata = metadata;
		}

		UsersSessions.upsert(query, update);

		UserPresence.setStatusFromConnections(userId, status);
	},

	setConnection: function(userId, connection, status) {
		if (!userId) {
			return;
		}

		logGrey('[user-presence] setConnection', userId, connection.id, status);

		var query = {
			_id: userId,
			'connections.id': connection.id
		};

		var now = new Date();

		var update = {
			$set: {
				'connections.$.status': status,
				'connections.$._updatedAt': now
			}
		};

		if (connection.metadata) {
			update.$set.metadata = connection.metadata;
		}

		var count = UsersSessions.update(query, update);

		if (count === 0) {
			return UserPresence.createConnection(userId, connection, status, connection.metadata);
		}

		UserPresence.setStatusFromConnections(userId, status);
	},

	setDefaultStatus: function(userId, status) {
		if (!userId) {
			return;
		}

		if (allowedStatus.indexOf(status) === -1) {
			return;
		}

		logYellow('[user-presence] setDefaultStatus', userId, status);

		var update = Meteor.users.update({_id: userId, statusDefault: {$ne: status}}, {$set: {statusDefault: status}});

		if (update > 0) {
			UserPresenceMonitor.processUser(userId, { statusDefault: status });
		}
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

		var userSession = UsersSessions.findOne({ 'connections.id': connectionId });

		if (userSession) {
			UsersSessions.update(query, update);

			userSession.connections = userSession.connections.filter(function(connection) {
				return connection.id !== connectionId;
			});

			UserPresence.setStatusFromConnections(userSession._id, null, userSession);
		}
	},

	setStatusFromConnections(userId, status, record) {
		if (typeof record === 'undefined') {
			record = UsersSessions.findOne(userId);
		}

		var connectionStatus = UserPresenceMonitor.getUserStatus(record.connections);

		if (!status) {
			status = connectionStatus;
		} else if (connectionStatus === 'online') {
			status = connectionStatus;
		}
		UserPresenceMonitor.setUserStatus(record, status, connectionStatus);
	},

	start: function() {
		Meteor.onConnection(function(connection) {
			connection.onClose(function() {
				if (connection.UserPresenceUserId !== undefined && connection.UserPresenceUserId !== null) {
					UserPresence.removeConnection(connection.id);
				}
			});
		});

		process.on('exit', Meteor.bindEnvironment(function() {
			if (Package['konecty:multiple-instances-status']) {
				UserPresence.removeConnectionsByInstanceId(InstanceStatus.id());
			} else {
				UserPresence.removeAllConnections();
			}
		}));

		// TODO: since client set himself as online on login as well, this might not be needed
		if (Package['accounts-base']) {
			Accounts.onLogin(function(login) {
				UserPresence.createConnection(login.user._id, login.connection);
			});
		}

		Meteor.publish(null, function() {
			if (this.userId == null && this.connection.UserPresenceUserId !== undefined && this.connection.UserPresenceUserId !== null) {
				UserPresence.removeConnection(this.connection.id);
				delete this.connection.UserPresenceUserId;
			}

			this.ready();
		});

		if (Package['konecty:multiple-instances-status']) {
			UserPresence.startObserveForDeletedServers();
		}

		UserPresence.removeLostConnections();

		UserPresenceEvents.on('setStatus', function(session, status, statusConnection) {
			var user = Meteor.users.findOne(session._id);

			if (!user) {
				return;
			}

			if (user.statusDefault != null && status !== 'offline' && user.statusDefault !== 'online') {
				status = user.statusDefault;
			}

			var query = {
				_id: session._id,
				$or: [
					{status: {$ne: status}},
					{statusConnection: {$ne: statusConnection}}
				]
			};

			var update = {
				$set: {
					status: status,
					statusConnection: statusConnection
				}
			};

			Meteor.users.update(query, update);

			UserPresenceEvents.emit('setUserStatus', user, status, statusConnection);
		});

		Meteor.methods({
			'UserPresence:connect': function(id, metadata) {
				this.unblock();
				UserPresence.createConnection(id || this.userId, this.connection, 'online', metadata);
			},

			'UserPresence:away': function() {
				this.unblock();
				UserPresence.setConnection(this.userId, this.connection, 'away');
			},

			'UserPresence:online': function() {
				this.unblock();
				UserPresence.setConnection(this.userId, this.connection, 'online');
			},

			'UserPresence:setDefaultStatus': function(status) {
				this.unblock();
				UserPresence.setDefaultStatus(this.userId, status);
			}
		});
	}
};
