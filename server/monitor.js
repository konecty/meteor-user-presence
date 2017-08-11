/* globals UserPresenceMonitor, UsersSessions */

UserPresenceMonitor = {
	callbacks: [],

	/**
	 * The callback will receive the following parameters: user, status, statusConnection
	 */
	onSetUserStatus: function(callback) {
		this.callbacks.push(callback);
	},

	runCallbacks: function(user, status, statusConnection) {
		this.callbacks.forEach(function(callback) {
			callback.call(null, user, status, statusConnection);
		});
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
			if (record.visitor === true) {
				UserPresenceMonitor.setVisitorStatus(record._id, 'offline');
			} else {
				UserPresenceMonitor.setUserStatus(record._id, 'offline');
			}

			if (action !== 'removed') {
				UsersSessions.remove({_id: record._id, 'connections.0': {$exists: false} });
			}
			return;
		}

		var currentStatus = UserPresenceMonitor.getUserStatus(record.connections);

		if (record.visitor === true) {
			UserPresenceMonitor.setVisitorStatus(record._id, currentStatus, currentStatus);
		} else {
			UserPresenceMonitor.setUserStatus(record._id, currentStatus, currentStatus);
		}
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

	setUserStatus: function(userId, status, statusConnection) {
		var user = Meteor.users.findOne(userId);

		if (typeof statusConnection === 'undefined') {
			statusConnection = status;
		}

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

		Meteor.users.update(query, update);

		this.runCallbacks(user, status, statusConnection);
	},

	setVisitorStatus: function(/*id, status*/) {}
};
