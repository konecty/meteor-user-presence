/* globals UserPresence */
import { debounce } from '../utils';

let timer, status;
const awayTime = Symbol('awayTime')
const setUserPresence = debounce((newStatus) => {
	if (!UserPresence.connected || newStatus === status) {
		return
	}
	switch(status) {
		case 'online':
			Meteor.call('UserPresence:online', UserPresence.userId);
			UserPresence.startTimer();
			break;
		case 'away':
			Meteor.call('UserPresence:away', UserPresence.userId);
			UserPresence.stopTimer();
			break;
		default:
			return;
	}
	status = newStatus;

}, 5000)

UserPresence = {
	get awayTime() {
		return this[awayTime];
	},
	set awayTime(time) {
		if (typeof time === "number") {
			this[awayTime] = time > 0 ? Math.max(0, 30000) : time;
		}
	},
	[awayTime]: 6000,//1 minute
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
	setAway: () => setUserPresence('away'),
	setOnline: () => setUserPresence('online'),
	start: function(userId) {
		if (this.started) {
			return;
		}
		this.userId = userId;

		// register a tracker on connection status so we can setup the away timer again (on reconnect)
		Tracker.autorun(() => {
			const connectionStatus = Meteor.status();
			this.connected = connectionStatus.connected;
			if (connectionStatus.connected) {
				return this.setOnline();
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

		this.started = true;
	}
};

Meteor.methods({
	'UserPresence:setDefaultStatus': function(status) {
		check(status, String);
		Meteor.users.update({_id: Meteor.userId()}, {$set: {status: status, statusDefault: status}});
	},
	'UserPresence:online': function() {
		let user = Meteor.user();
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
