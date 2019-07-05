/* globals UserPresence */
import { debounce } from '../utils';
let timer, status;
const setUserPresence = debounce((newStatus) => {
	if (!UserPresence.connected || newStatus === status) {
		UserPresence.startTimer();
		return;
	}
	switch (newStatus) {
		case 'online':
			Meteor.call('UserPresence:online', UserPresence.userId);
			break;
		case 'away':
			Meteor.call('UserPresence:away', UserPresence.userId);
			UserPresence.stopTimer();
			break;
		default:
			return;
	}
	status = newStatus;
}, 1000);

UserPresence = {
	awayTime: 60000, // 1 minute
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

	runCallbacks: function(user, status, statusChangedTs) {
		this.callbacks.forEach(function(callback) {
			callback.call(null, user, status, statusChangedTs);
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
	setAway: () => setUserPresence('away'),
	setOnline: () => setUserPresence('online'),
	start: function(userId) {
		// after first call overwrite start function to only call startTimer
		this.start = () => { this.startTimer(); };
		this.userId = userId;

		// register a tracker on connection status so we can setup the away timer again (on reconnect)
		Tracker.autorun(() => {
			const { connected } = Meteor.status();
			this.connected = connected;
			if (connected) {
				this.startTimer();
				status = 'online';
				return;
			}
			this.stopTimer();
			status = 'offline';
		});

		['mousemove', 'mousedown', 'touchend', 'keydown']
			.forEach(key => document.addEventListener(key, this.setOnline));

		window.addEventListener('focus', this.setOnline);

		if (this.awayOnWindowBlur === true) {
			window.addEventListener('blur', this.setAway);
		}
	}
};

Meteor.methods({
	'UserPresence:setDefaultStatus': function(status) {
		check(status, String);
		Meteor.users.update({_id: Meteor.userId()}, {$set: { status, statusDefault: status }});
	},
	'UserPresence:online': function() {
		const user = Meteor.user();
		const now = Date.now();
		if (user && user.status !== 'online' && user.statusDefault === 'online') {
			Meteor.users.update({_id: Meteor.userId()}, {$set: {status: 'online', statusChangedTs: now}});
		}
		UserPresence.runCallbacks(user, 'online', now);
	},
	'UserPresence:away': function() {
		var user = Meteor.user();
		const now = Date.now();
		UserPresence.runCallbacks(user, 'away', now);
	}
});
