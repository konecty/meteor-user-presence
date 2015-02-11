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