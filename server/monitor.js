/* globals UserPresenceMonitor, UsersSessions */
var EventEmitter = Npm.require('events');

UserPresenceEvents = new EventEmitter();

UserPresenceMonitor = {
	callbacks: [],

	/**
	 * The callback will receive the following parameters: user, status, statusConnection
	 */
	onSetUserStatus: function(callback) {
		UserPresenceEvents.on('setUserStatus', callback);
	},

	getUserStatus: function(connections) {
		var currentStatus = 'offline';
		connections.forEach(function(connection) {
			if (connection.status === 'online') {
				currentStatus = 'online';
			} else {
				if (connection.status === 'away' && currentStatus === 'offline') {
					currentStatus = 'away';
				}
			}
		});

		return currentStatus;
	},

	processUserSession: function(record, action) {
		if (action === 'removed' && (record.connections == null || record.connections.length === 0)) {
			return;
		}

		if (record.connections == null || record.connections.length === 0 || action === 'removed') {
			UserPresenceMonitor.setUserStatus(record, 'offline');

			if (action !== 'removed') {
				UsersSessions.remove({_id: record._id, 'connections.0': {$exists: false} });
			}
			return;
		}

		var currentStatus = UserPresenceMonitor.getUserStatus(record.connections);

		UserPresenceMonitor.setUserStatus(record, currentStatus, currentStatus);
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

	setUserStatus: function(session, status, statusConnection) {
		if (typeof statusConnection === 'undefined') {
			statusConnection = status;
		}
		UserPresenceEvents.emit('setStatus', session, status, statusConnection);
	}
};
