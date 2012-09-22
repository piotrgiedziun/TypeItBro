Usage:
	npm install
	node app.js
	open http://127.0.0.1:8001 (8001 by default; process.env.PORT)

Used technology:
	- socket.io
		- binding sockets
		- socket queue (finding opponent)
		- store unique static data for game (2 paired socket)
		- change usage
		- double checking (for security)

	- node.js
		- event base application
		- ejs as template system
		- request (read data form web)
		- fs (read data form local file - static "database")
Demo:
	http://typeitbro.eu01.aws.af.cm/
Screenshots:
	https://github.com/piotrgiedziun/TypeItBro/tree/master/screenshots