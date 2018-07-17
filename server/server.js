/* globals InstanceStatus, UsersSessions, UserPresenceMonitor, UserPresence */
import Redis from 'ioredis';
const prefix = (process.env.REDIS_PREFIX || 'rocket-chat') + '/';

const field = process.env.REDIS_FIELD;

const redis = new Redis({
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || "localhost",
  password: process.env.REDIS_PASSWORD
});

const pub = new Redis({
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || "localhost",
  password: process.env.REDIS_PASSWORD
});

UsersSessions._ensureIndex({'connections.instanceId': 1}, {sparse: 1, name: 'connections.instanceId'});
UsersSessions._ensureIndex({'connections.id': 1}, {sparse: 1, name: 'connections.id'});

const allowedStatus = ['online', 'away', 'busy', 'offline'];

let logEnable = false;

const log = function(msg, color) {
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

const multi = { multi: true }
const instanceId = Package['konecty:multiple-instances-status'] && InstanceStatus.id();

const redisSetStatus = field ? ({ _id }, status) => {
	const user = Meteor.users.findOne({
		_id
	}, { fields: { [field]: 1} })
	if(!user) {
		return;
	}
	pub.publish(`${prefix}userPresence/${ user[field] }`, status);
	pub.hset(`${prefix}userPresence`, user[field], status);
} : ({ _id }, status) => {
	pub.publish(`${ prefix }userPresence/${ _id }`, status);
	pub.hset(`${ prefix }userPresence`, _id, status);
}

const redisOnSetStatus = field ? (pattern, topic, status) => {
	if(`${ prefix }setUserPresence/*` === pattern) {
		const identifier = topic.replace(pattern.replace('*', ''), '');
		const user = Meteor.users.findOne({
			[field]: identifier
		}, { fields: { _id: 1} })
		if(!user) {
			return;
		}
		return UserPresence.setDefaultStatus(user._id, status);
	}
} : (pattern, topic, status) => {
	if(`${ prefix }setUserPresence/*` === pattern) {
		const identifier = topic.replace(pattern.replace("*", ""), "");
		UserPresence.setDefaultStatus(identifier, status);
	}
}

Meteor.startup(()=> {
	redis.psubscribe(`${ prefix }setUserPresence/*`, Meteor.bindEnvironment(function (err, count) {
		return err && logRed(err);
	}))

	redis.on("pmessage", Meteor.bindEnvironment(redisOnSetStatus));

	UserPresenceEvents.on('setUserStatus',  Meteor.bindEnvironment(redisSetStatus));
})

UserPresence = {
	activeLogs: function() {
		logEnable = true;
	},

	removeLostConnections: instanceId ? function() {
		const ids = InstanceStatus.getCollection().find({}, {fields: {_id: 1}}).fetch().map(({_id}) => _id);
		const connections = { instanceId: { $nin: ids } };

		const usersId = UsersSessions.find({
			connections
		}, { fields: { _id: 1 } });

		const updateSessions = {
			$pull: {
				connections
			}
		};

		Meteor.users.update({ _id:{ $in: ids }}, {$set: {status: 'offline', statusConnection: 'offline'}}, multi);
		UsersSessions.update({}, update, multi);
	} : function() {
		UsersSessions.remove({});
		Meteor.users.update({}, {$set: {status: 'offline', statusConnection: 'offline'}}, multi);
	},

	removeConnectionsByInstanceId: function(instanceId) {
		logRed('[user-presence] removeConnectionsByInstanceId', instanceId);
		const update = {
			$pull: {
				connections: {
					instanceId
				}
			}
		};

		UsersSessions.update({}, update, multi);
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

	createConnection: function(_id, connection, status = 'online', metadata) {
		if (!_id || !connection.id) {
			return;
		}

		connection.UserPresenceUserId = _id;

		logGreen('[user-presence] createConnection', _id, connection.id, status, metadata);

		const query = { _id };

		const now = new Date();

		const update = {
			$push: {
				connections: {
					id: connection.id,
					instanceId,
					status,
					_createdAt: now,
					_updatedAt: now
				}
			}
		};

		if (metadata) {
			update.$set = {
				metadata
			};
			connection.metadata = metadata;
		}

		UsersSessions.upsert(query, update);
	},

	setConnection: function(userId, connection, status) {
		if (!userId) {
			return;
		}

		logGrey('[user-presence] setConnection', userId, connection.id, status);

		const query = {
			_id: userId,
			'connections.id': connection.id
		};

		const now = new Date();

		const update = {
			$set: {
				'connections.$.status': status,
				'connections.$._updatedAt': now
			}
		};

		if (connection.metadata) {
			update.$set.metadata = connection.metadata;
		}

		const count = UsersSessions.update(query, update);

		if (count === 0) {
			return UserPresence.createConnection(userId, connection, status, connection.metadata);
		}

		if (status === 'online' || status === 'away') {
			Meteor.users.update({_id: userId, statusDefault: 'online', status: {$ne: status}}, {$set: {status: status}});
		}
	},

	setDefaultStatus: function(userId, statusDefault) {
		if (!userId) {
			return;
		}

		if (allowedStatus.indexOf(statusDefault) === -1) {
			return;
		}

		logYellow('[user-presence] setDefaultStatus', userId, statusDefault);

		const update = Meteor.users.update({_id: userId, statusDefault: {$ne: statusDefault}}, {$set: {statusDefault: statusDefault}});

		if (update > 0) {
			UserPresenceMonitor.processUser(userId, { statusDefault });
		}
	},

	removeConnection: function(id) {
		logRed('[user-presence] removeConnection', id);

		const query = {
			'connections.id': id
		};

		const update = {
			$pull: {
				connections: {
					id
				}
			}
		};

		UsersSessions.update(query, update);
	},

	start: function() {
		Meteor.onConnection(function(connection) {
			connection.onClose(function() {
				if (connection.UserPresenceUserId !== undefined && connection.UserPresenceUserId !== null) {
					UserPresence.removeConnection(connection.id);
				}
			});
		});

		process.on('exit', Meteor.bindEnvironment(instanceId ? function() {
			UserPresence.removeConnectionsByInstanceId(instanceId);
		} : function() {
			UserPresence.removeAllConnections();
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

		if (Package['konecty:multiple-instances-status']) {
			UserPresence.startObserveForDeletedServers();
		}

		UserPresence.removeLostConnections();

		UserPresenceEvents.on('setStatus', function(_id, status) {
			const user = Meteor.users.findOne(_id, { fields: { statusDefault: 1 } });
			if (!user) {
				return;
			}

			const statusConnection = status;

			if (user.statusDefault != null &&  user.statusDefault !== 'online' && status !== 'offline') {
				status = user.statusDefault;
			}

			const query = {
				_id,
				$or: [
					{status: {$ne: status}},
					{statusConnection: {$ne: statusConnection}}
				]
			};

			const update = {
				$set: {
					status,
					statusConnection
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

			'UserPresence:away': function(id) {
				this.unblock();
				UserPresence.setConnection(id || this.userId, this.connection, 'away');
			},

			'UserPresence:online': function(id) {
				this.unblock();
				UserPresence.setConnection(id || this.userId, this.connection, 'online');
			},

			'UserPresence:setDefaultStatus': function(id, status) {
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
