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