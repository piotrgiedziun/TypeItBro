function TypeItBro (options) {
	// set settings data
	this.defaults = { validate: false };
	this.settings = $.extend({}, this.defaults, options);
	
	// reset text cursors
	this.text = '';
	this.name = '';
	this.errors = {
		you: {},
		bro: {}
	};
	this.text_pos = 0;
	this.error_message = '';

	// socket
	this.socket = io.connect("/socket");
	
	// start game
	this.login();
}

function char(text) {
	if(text === " ") {
		return "(space)";
	}

	return text;
}

function getHashParameter(name) {
    return decodeURI(
        (RegExp(name + '=' + '(.+?)(&|$)').exec(location.hash.slice(1))||[,null])[1]
    );
}

function timeObject(secs)
{
    var hours = Math.floor(secs / (60 * 60));
   
    var divisor_for_minutes = secs % (60 * 60);
    var minutes = Math.floor(divisor_for_minutes / 60);
 
    var divisor_for_seconds = divisor_for_minutes % 60;
    var seconds = Math.ceil(divisor_for_seconds);
   
    return {
        "h": (hours<10)?('0'+hours):hours,
        "m": (minutes<10)?('0'+minutes):minutes,
        "s": (seconds<10)?('0'+seconds):seconds
    };;
}

TypeItBro.prototype.login = function() {
	var inst = this;
	$(this.settings.type_area.you).attr('readonly', true);


	$(this.settings.name_form).submit(function(e) {
		if( $(inst.settings.user_name).attr('readonly') != "readonly" ) {
			$(inst.settings.start).click();
		}

		e.preventDefault();
		return false;
	});

	$(this.settings.start).click(function () {
		// lock user name input
		$(inst.settings.user_name).attr('readonly', true);
		var btn = $(this);
		btn.button('loading');
		$(inst.settings.name_error).hide();

		inst.socket.emit('connect', $(inst.settings.user_name).val(), function(result) {
			if(result === false) {
				$(inst.settings.user_name).attr('readonly', false);
				$(inst.settings.start).button('reset');
				$(inst.settings.name_error).show();
				return;
			}
			inst.name = $(inst.settings.user_name).val();
			$(inst.settings.name_area.you).text($(inst.settings.user_name).val());
			$(inst.settings.start).text('Looking for bro...');
		});
	});

	// auto login
	if(getHashParameter('name') != "null") {
		$(inst.settings.user_name).val(decodeURIComponent(getHashParameter('name')));
		$(inst.settings.start).click();
		location.hash = "";
	}

	this.socket.on('start', function( time ) {
		inst.start(time);
	});
};

TypeItBro.prototype.start = function(data) {
	var inst = this;

	// set opponent name
	$(inst.settings.name_area.bro).text(data.name);
	// set time
	var time = data.time;

	// count time
	var recived = false;
	var timer = setInterval(function() {

		if(recived === true) {
			// recived answer and interval is still up
			clearInterval(timer);
			return;
		}

		$(inst.settings.text_area.you).html('<div class="time">'+--time+'</div>');
		$(inst.settings.text_area.bro).html('<div class="time">'+time+'</div>');

		if(time == 0 && recived != true) {
			clearInterval(timer);
			$(inst.settings.text_area.you).html('Waiting for text...');
			$(inst.settings.text_area.bro).text(inst.text);
		}
	}, 1000);

	this.socket.on('text', function(text) {
		recived = true;
		inst.text = text;
		$(inst.settings.text_area.you).text(text);
		$(inst.settings.text_area.bro).text(text);
		inst.run();
	});
};

TypeItBro.prototype.run = function() {
	var inst = this;

	// remove disables
	$(this.settings.type_area.you).removeAttr('readonly');

	var time = 0;
	var timer = setInterval(function() {
		var currentTime = timeObject(++time);

		$(inst.settings.timer).html(currentTime.m +':'+currentTime.s);
	}, 1000);

	// focust input area whenever key is pressed
	$(document).keypress(function(event) {
		if( ! $(inst.settings.type_area.you).is(":focus") 
			&&  $(inst.settings.type_area.you).attr('readonly') != "readonly") {
    		$(inst.settings.type_area.you).focus();
    		$(inst.settings.type_area.you).trigger(event);
    	}
  	});

  	// init popover
  	$(inst.settings.text_area.you).popover({
		trigger: 'manual',
		placement: 'bottom',
		html: true,
		title: "Invalid character pressed.",
		content: function() { return inst.error_message; }
	});

  	// validate input
	$(this.settings.type_area.you).keypress(function(event) {
		// don't care about this error.. It's made by invalid usage of user
		if(inst.text.length <= inst.text_pos || inst.text_pos < 0 || $(this).attr('readonly') == "readonly") return false;
		// user typed invalid character
		if(inst.text[inst.text_pos].toLowerCase() != String.fromCharCode(event.keyCode).toLowerCase()) {
			// show prompt and block text area
			inst.error_message = "You should press "+char(inst.text[inst.text_pos])+".";
			console.log(inst.error_message);
			$(inst.settings.text_area.you).popover('show');
			inst.errors.you[inst.text_pos] = true;
			
			// brodcast position
			inst.socket.emit('progress', String.fromCharCode(event.keyCode));
			inst.renderText('you', inst.text_pos);

			return false;
		}
		$(inst.settings.text_area.you).popover('hide');
		inst.text_pos++;

		// finished game
		if(inst.text.length == inst.text_pos) {
			// game over
			$(inst.settings.type_area.you).val($(inst.settings.type_area.you).val() + String.fromCharCode(event.keyCode).toLowerCase());
			$(inst.settings.type_area.you).attr('readonly', true);
		}

		// brodcast position
		inst.socket.emit('progress', String.fromCharCode(event.keyCode));
		inst.renderText('you', inst.text_pos);
	});

	// play again
	$('.play_again').live('click', function() {
		location.hash="name="+encodeURIComponent(inst.name);
		location.reload(true);
	});

	this.socket.on('progress', function(progress) {
		console.log('progress where='+progress);
		inst.renderText('bro', progress);
	});

	this.socket.on('error', function(where) {
		console.log('error where='+where);
		inst.errors.bro[where] = true;
		inst.renderText('bro', where);
	});

	this.socket.on('winner', function() {
		clearInterval(timer);
		$(inst.settings.type_area.you).attr('readonly', true);
		$(inst.settings.text_area.bro).prepend('<div class="lose">LOSER!</div>');
		$(inst.settings.text_area.you).prepend('<div class="win">WINNER!<button class="play_again btn btn-success btn-large">Play again!</button></div>');
	});

	this.socket.on('loser', function() {
		clearInterval(timer);
		$(inst.settings.type_area.you).attr('readonly', true);
		$(inst.settings.text_area.bro).prepend('<div class="win">WINNER!</div>');
		$(inst.settings.text_area.you).prepend('<div class="lose">LOSER!<button class="play_again btn btn-success btn-large">Play again!</button></div>');
	});
};

// render text with progress and errors marks
TypeItBro.prototype.renderText = function(who, progress) {
	var code = '<span class="selected '+who+'">';
	for( var cursor in this.text ) {
		if(progress == cursor) code += '</span>';
		code += this.errors[who][cursor] === true ? ('<span class="error">'+this.text[cursor]+'</span>'):this.text[cursor];
	}
	$(this.settings.text_area[who]).html(code);
};