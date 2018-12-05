/* globals InstanceStatus, UsersSessions, UserPresenceMonitor, UserPresence, PresenceStream */
import 'colors';

UsersSessions._ensureIndex({'connections.instanceId': 1}, {sparse: 1, name: 'connections.instanceId'});
UsersSessions._ensureIndex({'connections.id': 1}, {sparse: 1, name: 'connections.id'});

PresenceStream = new Meteor.Streamer('user-presence', { retransmit: false, retransmitToSelf: true });
PresenceStream.serverOnly = true;
PresenceStream.allowRead('none');
PresenceStream.allowEmit('all');
PresenceStream.allowWrite('none');

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

	createConnection: function(userId, connection, status, metadata) {
		// if connections is invalid, does not have an userId or is already closed, don't save it on db
		if (!userId || !connection.id || connection.closed) {
			return;
		}

		connection.UserPresenceUserId = userId;

		status = status || 'online';

		logGreen('[user-presence] createConnection', userId, connection.id, status, metadata);

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

		// make sure closed connections are being created
		if (!connection.closed) {
			UsersSessions.upsert(query, update);
		}
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

		if (status === 'online') {
			Meteor.users.update({_id: userId, statusDefault: 'online', status: {$ne: 'online'}}, {$set: {status: 'online'}});
		} else if (status === 'away') {
			Meteor.users.update({_id: userId, statusDefault: 'online', status: {$ne: 'away'}}, {$set: {status: 'away'}});
		}
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

		UsersSessions.update(query, update);
	},

	start: function() {
		Meteor.onConnection(function(connection) {
			connection.onClose(function() {
				// mark connection as closed so if it drops in the middle of the process it doesn't even is created
				connection.closed = true;

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

		UserPresenceEvents.on('setStatus', function(userId, status) {
			var user = Meteor.users.findOne(userId);
			var statusConnection = status;

			if (!user) {
				return;
			}

			if (user.statusDefault != null && status !== 'offline' && user.statusDefault !== 'online') {
				status = user.statusDefault;
			}

			var query = {
				_id: userId,
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

			const result = Meteor.users.update(query, update);

			// if nothing updated, do not stream anything
			if (result) {
				UserPresenceEvents.emit('setUserStatus', user, status, statusConnection);

				// emit internally
				PresenceStream.emitWithScope('change', {}, {
					_id: user._id,
					username: user.username,
					name: user.name,
					status,
					utcOffset: user.utcOffset,
				});
			}
		});

		Meteor.methods({
			'UserPresence:connect': function(id, metadata) {
				check(id, Match.Maybe(String));
				check(metadata, Match.Maybe(Object));
				this.unblock();
				UserPresence.createConnection(id || this.userId, this.connection, 'online', metadata);
			},

			'UserPresence:away': function(id) {
				check(id, Match.Maybe(String));
				this.unblock();
				UserPresence.setConnection(id || this.userId, this.connection, 'away');
			},

			'UserPresence:online': function(id) {
				check(id, Match.Maybe(String));
				this.unblock();
				UserPresence.setConnection(id || this.userId, this.connection, 'online');
			},

			'UserPresence:setDefaultStatus': function(id, status) {
				check(id, Match.Maybe(String));
				check(status, Match.Maybe(String));
				this.unblock();

				// backward compatible
				if (arguments.length === 1) {
					status = id;
					id = this.userId;
				}
				UserPresence.setDefaultStatus(id || this.userId, status);
			}
		});
	}
};
