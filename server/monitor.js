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

		if (record.connections == null || record.connections.length === 0 || action === 'removed') {
			UserPresenceMonitor.setStatus(record._id, 'offline', record.metadata);

			if (action !== 'removed') {
				UsersSessions.remove({_id: record._id, 'connections.0': {$exists: false} });
			}
			return;
		}

		var connectionStatus = 'offline';
		record.connections.forEach(function(connection) {
			if (connection.status === 'online') {
				connectionStatus = 'online';
			} else if (connection.status === 'away' && connectionStatus === 'offline') {
				connectionStatus = 'away';
			}
		});

		UserPresenceMonitor.setStatus(record._id, connectionStatus, record.metadata);
	},

	processUser: function(id, fields) {
		if (fields.statusDefault == null) {
			return;
		}

		var userSession = UsersSessions.findOne({_id: id});

		if (userSession) {
			UserPresenceMonitor.processUserSession(userSession, 'changed');
		}
	},

	setStatus: function(id, status, metadata) {
		UserPresenceEvents.emit('setStatus', id, status, metadata);
	}
};
