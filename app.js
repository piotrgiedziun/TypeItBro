/**
 * Module dependencies.
 */

var express = require('express')
  , sio = require('socket.io')
  , request = require('request')
  , fs = require('fs');


/**
 * Functions.
 */
 htmlEscape = module.exports.htmlEscape = function(text) {
   return text.replace(/&/g, '&amp;').
     replace(/</g, '&lt;');
 }
randomInRange = module.exports.randomInRange = function(min, max) {
  return Math.round(min+(Math.random()*(max-min)));
}


/**
 * Load static data
 */
var file = fs.readFileSync('books.json', 'utf8'); 
var books = JSON.parse(file); 

/**
 * App.
 */

var app = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname + '/templates');
  app.set('view engine', 'ejs');
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  res.render('index', { layout: false });
});

/**
 * App listen.
 */

app.listen((process.env.PORT||8001), function () {
  var addr = app.address();
  console.log('   app listening on http://' + addr.address + ':' + addr.port);
});

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app, { log: false })
  , game = io.of('/socket');

var gameLogic = function() {
  inst = this;
  this.time = 2;
  this.players = {};
  this.text = '';
  this.is_winer = false;

  this.run = function() {
    // reset text position
    for(player_id in this.players) {
      this.players[player_id].text_pos = 0;
    }
    // get text to display
    this.get_text(function(text) {
      inst.text = text;
      inst.start_cooldown();
    });
  }

  // add player
  this.add = function(socket) {
    console.log('id='+socket.id);
    this.players[socket.id] = socket;
  }

  // this one will be fun!
  this.get_text = function(callback) {

    var forbidden_chars = [
      '**', '---'
    ];

    // get random book
    var book = books[randomInRange(0, books.length-1)];

    // get source (text form book)
    request(book.url, function (error, response, text) {
      if (!error && response.statusCode == 200) {
        var valid_paragraphs = new Array();

        var paragraphs = text.split(/\r\n\r\n/g);
        var lines_in_paragraph;

        for(paragraph_id in paragraphs) {
          lines_in_paragraph = paragraphs[paragraph_id].split(/\n/g).length;

          // @TODO: if text is longer cut it our (".", "?", "!", ";")
          if(lines_in_paragraph > 6 && lines_in_paragraph < 10) {
            // check for forbidden chars
            for(forbidden_char in forbidden_chars) {
              if(paragraphs[paragraph_id].indexOf(forbidden_char) != -1) {
                break;
              }
            }
            // only valids paragraphs can reach this line
            valid_paragraphs.push(paragraphs[paragraph_id]
              .replace(/(\r\n|\n|\r)/gm, ' ')
              .replace(/  /gm, ' ')
            );
          }
        }
        // invloke callback with selected text
        if( valid_paragraphs.length == 0) {
          callback("I like pizza. Our server can't parse data. Try again.");
        }
        callback(valid_paragraphs[randomInRange(0, valid_paragraphs.length-1)]);
      }
    });
  }

  this.start_cooldown = function() { 
    var inst = this;

    for(player_id in this.players) {
      this.players[player_id].get('name', function(err, name) {
        inst.players[inst.get_opponent_id(player_id)].emit('start', {time: inst.time, name: name});
      });
    }

    setTimeout(function() {
      // emit text to players
      inst.emit('text', inst.text);
    }, this.time*1000);
  }

  this.get_opponent_id = function(your_id) {
    for(player_id in this.players) {
      if(player_id != your_id) {
        return player_id;
      }
    }
    return 0;
  }

  this.set_progress = function(who, letter) {
    if(this.players[who].text_pos > this.text.length) return;
    
    var opponent_id = this.get_opponent_id(who);
    
    if(this.text[this.players[who].text_pos].toLowerCase() == letter.toLowerCase()) {
      this.players[who].text_pos++;
      this.players[opponent_id].emit('progress', this.players[who].text_pos);

      if(this.players[who].text_pos == this.text.length) {
        // win!!
        console.log('winer!');
        if(this.is_winer === false) {
          this.is_winer = true;
          this.players[opponent_id].emit('loser');
          this.players[who].emit('winner');
        }
      }
    }else{
      this.players[opponent_id].emit('error', this.players[who].text_pos);
    }
  }

  this.emit = function(name, object) {
    for(player_id in this.players) {
      this.players[player_id].emit(name, object);
    }
  }
};

game.on('connection', function ( socket ) {
  
  socket.on('connect', function ( name, callback ) {
    if( name == null || name.length < 2 || name.length > 25) {
      return callback( false );
    }
    name = htmlEscape(name);

    console.log('>> connected name='+name);
    
    socket.set('name', name);
    socket.join('waiting');

    if ( game.clients('waiting').length == 2) {
      var gameInstance = new gameLogic();

      game.clients('waiting').forEach(function(client, index) {
        client.leave('waiting');
        client.set('game', gameInstance);
        gameInstance.add(client);
      });

      gameInstance.run();
    }
    
    callback( true )
  });

  socket.on('progress', function(letter) {
    socket.get('game', function(err, game) {
      game.set_progress(socket.id, letter);
    }); 
  });

});