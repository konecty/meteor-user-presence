UserPresenceMonitor = {
	start: function() {
		UsersSessions.find({}).observe({
			added: UserPresenceMonitor.processUserSession,
			changed: UserPresenceMonitor.processUserSession,
			removed: UserPresenceMonitor.processUserSession
		});

		Meteor.users.find({}).observe({
			changed: UserPresenceMonitor.processUser,
			removed: UserPresenceMonitor.processUser
		});
	},

	processUserSession: function(record) {
		if (record.connections == null || record.connections.length === 0) {
			UserPresenceMonitor.setUserStatus(record._id, 'offline');
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

		UserPresenceMonitor.setUserStatus(record._id, connectionStatus);
	},

	processUser: function(record) {

		var userSession = UsersSessions.findOne({_id: record._id});

		if (userSession) {
			UserPresenceMonitor.processUserSession(userSession);
		}
	},

	setUserStatus: function(userId, status) {
		var user = Meteor.users.findOne(userId)
			statusConnection = status;

		if (user.statusDefault != null && status !== 'offline' && user.statusDefault !== 'auto') {
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
	}
}