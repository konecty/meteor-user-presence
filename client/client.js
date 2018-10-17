/* globals UserPresence */
import { debounce } from '../utils';

var timer, status;

UserPresence = {
	awayTime: 60000, //1 minute
	awayOnWindowBlur: false,
	callbacks: [],
	connected: true,
	started: false,
	userId: null,

	/**
	 * The callback will receive the following parameters: user, status
	 */
	onSetUserStatus: function(callback) {
		this.callbacks.push(callback);
	},

	runCallbacks: function(user, status) {
		this.callbacks.forEach(function(callback) {
			callback.call(null, user, status);
		});
	},

	startTimer: function() {
		UserPresence.stopTimer();
		if (!UserPresence.awayTime) {
			return;
		}
		timer = setTimeout(UserPresence.setAway, UserPresence.awayTime);
	},
	stopTimer: function() {
		clearTimeout(timer);
	},
	restartTimer: function() {
		UserPresence.startTimer();
	},
	setAway: function() {
		if (status !== 'away') {
			status = 'away';
			UserPresence.connected && Meteor.call('UserPresence:away', UserPresence.userId);
		}
		UserPresence.stopTimer();
	},
	setOnline: debounce(function() {
		if (status !== 'online') {
			status = 'online';
			UserPresence.connected && Meteor.call('UserPresence:online', UserPresence.userId);
		}
		UserPresence.startTimer();
	}, 1000),
	start: function(userId) {
		if (UserPresence.started) {
			return;
		}
		this.userId = userId;

		// register a tracker on connection status so we can setup the away timer again (on reconnect)
		Tracker.autorun(function() {
			var connectionStatus = Meteor.status();
			UserPresence.connected = connectionStatus.connected;
			if (connectionStatus.connected) {
				UserPresence.setOnline();
			} else {
				UserPresence.stopTimer();
				status = 'offline';
			}
		});

		document.addEventListener('mousemove', UserPresence.setOnline);
		document.addEventListener('mousedown', UserPresence.setOnline);
		document.addEventListener('touchend', UserPresence.setOnline);
		document.addEventListener('keydown', UserPresence.setOnline);
		window.addEventListener('focus', UserPresence.setOnline);

		if (UserPresence.awayOnWindowBlur === true) {
			window.addEventListener('blur', UserPresence.setAway);
		}

		UserPresence.started = true;
	}
};

Meteor.methods({
	'UserPresence:setDefaultStatus': function(status) {
		check(status, String);
		Meteor.users.update({_id: Meteor.userId()}, {$set: {status: status, statusDefault: status}});
	},
	'UserPresence:online': function() {
		var user = Meteor.user();
		if (user && user.status !== 'online' && user.statusDefault === 'online') {
			Meteor.users.update({_id: Meteor.userId()}, {$set: {status: 'online'}});
		}
		UserPresence.runCallbacks(user, 'online');
	},
	'UserPresence:away': function() {
		var user = Meteor.user();
		UserPresence.runCallbacks(user, 'away');
	}
});
