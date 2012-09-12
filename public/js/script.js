function TypeItBro (options) {
	// set settings data
	this.defaults = { validate: false };
	this.settings = $.extend({}, this.defaults, options);
	
	// reset text cursors
	this.text = '';
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

TypeItBro.prototype.login = function() {
	var inst = this;
	$(this.settings.type_area.you).attr('readonly', true);

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
			$(inst.settings.start).text('Looking for bro...');
		});
	});

	this.socket.on('start', function( time ) {
		inst.start(time);
	});
};

TypeItBro.prototype.start = function(time) {
	var inst = this;

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
			$(inst.settings.text_area.bro).text(text);
		}
	}, 1000);

	this.socket.on('text', function(text) {
		recived = true;
		console.log(text);
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

	// focust input area whenever key is pressed
	$(document).keypress(function(event) {
		if( ! $(inst.settings.type_area.you).is(":focus")) {
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
		if(inst.text.length <= inst.text_pos || inst.text_pos < 0) return false;
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

	this.socket.on('progress', function(progress) {
		console.log('progress where='+progress);
		inst.renderText('bro', progress);
	});

	this.socket.on('error', function(where) {
		console.log('error where='+where);
		inst.errors.bro[where] = true;
		inst.renderText('bro', where);
	});

	this.socket.on('win', function() {
		console.log('opponent win! u suck!');
		$(inst.settings.text_area.bro).prepend('<div class="win">WINER!</div>');
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