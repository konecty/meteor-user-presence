/* globals UserPresenceMonitor, UsersSessions */
var EventEmitter = Npm.require('events');

UserPresenceEvents = new EventEmitter();

UserPresenceMonitor = {
	/**
	 * The callback will receive the following parameters: user, status, statusConnection
	 */
	onSetUserStatus: function(callback) {
		UserPresenceEvents.on('setUserStatus', callback);
	},

	start: function() {
		UsersSessions.find({}).observe({
			added: function(record) {
				UserPresenceMonitor.processUserSession(record, 'added');
			},
			changed: function(record) {
				UserPresenceMonitor.processUserSession(record, 'changed');
			},
			removed: function(record) {
				UserPresenceMonitor.processUserSession(record, 'removed');
			}
		});
	},

	processUserSession: function(record, action) {
		if (action === 'removed' && (record.connections == null || record.connections.length === 0)) {
			return;
		}

		if (action === 'removed' || record.connections == null || record.connections.length === 0) {
			UserPresenceMonitor.setStatus(record._id, 'offline', record.metadata);

			if (action !== 'removed') {
				UsersSessions.remove({_id: record._id, 'connections.0': {$exists: false} });
			}
			return;
		}

		let connectionStatus = 'offline';
		record.connections.some(function(connection) {
			connectionStatus = connection.status;
			return connection.status === "online";
		});

		UserPresenceMonitor.setStatus(record._id, connectionStatus, record.metadata);
	},

	processUser: function(_id, fields) {
		if (fields.statusDefault == null) {
			return;
		}

		const userSession = UsersSessions.findOne({_id});

		if (userSession) {
			UserPresenceMonitor.processUserSession(userSession, 'changed');
		}
	},

	setStatus: function(id, status, metadata) {
		UserPresenceEvents.emit('setStatus', id, status, metadata);
	}
};
