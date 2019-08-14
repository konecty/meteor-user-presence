# 2.6.0 (2019-08-14)
* Do not allow users change another users status (#42)

# 2.5.0 (2019-07-11)
* Remove user's connection on logout

# 2.4.0 (2018-12-13)
* Allow presence monitoring to be completely disabled
* Do not emit a status change if it has not changed
* Do not call `connect` anymore
* Add a `debounce` to `setAway`

# 2.3.0 (2018-11-16)
* Export `UsersSessions` collection
* Remove `underscore` package dependency
* Add `check` for all methods' params
* Replace `nooitaf:colors` Meteor package for its npm package

# 2.2.0 (2018-08-08)
* Prevent already closed connections from being stored on db

# 2.1.0 (2018-06-09)
* Do not start timer if `awayTime` is `null`
* Start user presence only once

# 2.0.1 (2017-12-13)
* Do not tracks a connection without `id`

# 2.0.0 (2017-12-04)
* [BREAK] Remove `visitor` related code, use the new `metadata` field instead
* Add event emitter for tracking any connection
* Stop away verification on disconnect and set user back online on reconnect
* Set correct user on `UserPresence:online` stub method
* Don't call methods if client is disconnected
* Allow set a value for `userId` on client side (instead of regular `Meteor.userId()`)

# 1.2.9 (2016-09-09)
* Fix #16; Prevent error when proccess exit
* Fix ESLint errors

# 1.2.8 (2016-05-25)
* Add _.throttle to set online status

# 1.2.7 (2016-05-25)
* Remove observeChanges on the users collection
* Accept multiple callbacks for status change

# 1.2.6 (2015-09-12)
* Add option to passa a callback to setUserStatus on UserPresenceMonitor

# 1.2.5 (2015-08-11)
* Set user online on touch events too

# 1.2.4 (2015-08-03)
* Add callback *onSetUserStatus* to watch status changes

# 1.2.3 (2015-07-25)
* Added this.ready to publication

# 1.2.2 (2015-02-11)
* Use Accounts if package 'accounts-base' exists

# 1.2.1 (2015-02-04)
* Create index for 'connections.id' to improve performance

# 1.2.0 (2015-02-04)
* Move api common.js file to top of list
* Create index for 'connections.instanceId' to improve performance
* Do not process removal of users
* Only process user changes that affects the field 'statusDefault'
* Pass action names to processUserSession
* Do not process removed sessions with no connections
* Remove sessions with no connections

# 1.1.0 (2015-02-02)
* Allow visitor status tracking
* Prevent error when no user was not found in setUserStatus

# 1.0.15 (2015-01-21)
* Allow pass status to createConnection
* Update field '_updatedAt' of connection when update connection status
* Change setConnection to use update instead upsert and recreate connection if no connetion exists

# 1.0.14 (2015-01-21)
* Improve latency compensation

# 1.0.13 (2015-01-21)
* Set user into connection on login to only remove connections with user

# 1.0.12 (2015-01-21)
* Add this.unblock() to all methods
