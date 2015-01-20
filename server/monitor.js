UserPresenceMonitor = {
	start: function() {
		UsersSessions.find({}).observe({
			added: UserPresenceMonitor.processUserSession,
			changed: UserPresenceMonitor.processUserSession,
			removed: UserPresenceMonitor.processUserSession
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

	setUserStatus: function(userId, status) {
		var user = Meteor.users.findOne(userId);

		if (user.statusDefault != null && status !== 'offline' && user.statusDefault !== 'auto') {
			status = user.statusDefault;
		}

		Meteor.users.update({_id: userId, status: {$ne: status}}, {$set: {status: status}});
	}
}