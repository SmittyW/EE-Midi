var midi;
var writeOnClear = false;

function parseFile(file) {
	var reader = new FileReader();
	reader.onload = function(e){
		var bytes = e.target.result;

		if (bytes instanceof ArrayBuffer) {
			var byteArray = new Uint8Array(bytes)
			bytes = String.fromCharCode.apply(null, byteArray)
		}

		midi = MIDIParser.parse(bytes);
		
		if (midi)
		{
			for (var a = 0; a < midi.track.length; a++)
			{	
				var track = midi.track[a];
				track.oldIndex = 0;
				track.getNext = function() {
					if (this.oldIndex >= this.event.length) {
						return false;
					}
					return this.event[this.oldIndex];
				}
				track.consume = function() {
					this.oldIndex++;
				}

				for (var b = 0; b < track.event.length; b++)
				{
					var e = track.event[b];
					e.Time = e.deltaTime
					if (b > 0) {
						e.Time += track.event[b-1].Time;
					}
				}
			}

			var filename = file.name;
			if(filename.length > 25) {
			    filename = filename.substring(0,24)+"...";
			}
			$("#filename").html(filename);
		}
	};
	reader.readAsDataURL(file);
}

var percussion = [
	0, 13, 3, 2, 7, 2, 12, 6, 13, 14,
	11, 10, 8, 10, 17, 17, 19, 9, 18,
	19, 16, 1, 18, 10, 11, 10, 10, 11,
	10, 11, 19, 19, 9, 9, 10, 10, 10,
	10, 19, 19, 19, 19, 19, 6, 17, 17, 17, 17
];

var guitar = [ 43, 44, 45, 46, 47, 48, 38, 39, 40, 41, 42, 32, 33, 34, 35, 36, 27, 28, 29, 30, 21, 22, 23, 24, 25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 ];

var oldTime = 0;
var isFinished = true;

function nextEvent() {
	var newTime = 0x7FFFFFFF;
	var ret = null;
	var whichTrack = null;
	for (var i = 0; i < midi.track.length; i++) {
		var t = midi.track[i];
		var e = t.getNext();

		if (e && e.type >= 8 && e.Time < newTime && e.Time >= oldTime ) {
			ret = e;
			whichTrack = t;
			newTime = e.Time;
		}
	}
	if (ret != null) {
		oldTime = ret.Time;
		whichTrack.consume();
	}
	else {
		isFinished = true;
	}
	return ret;
}

function writeCheck(){
	if (BH != null && midi != null) {
		$("#file").prop("disabled", true);

		var clear = !$("#clear").is(":checked");
	    if (clear) {
	    	writeOnClear = true;
	    	connection.send("say", "/clear");
	    }
	    else write();
	}
}

function write()
{
	for (var i = 0; i < midi.track.length; i++)
	{	
		midi.track[i].oldIndex = 0;
	}
	oldTime = 0;
	isFinished = false;
	var x = 1;
	var y = 2;
	var offset = 0;
	var worldHeight = BH.height;
	var distance = worldHeight - 6;
	var id = 1;
	var xprev = 1;
	var tempo = 60000000 / 120;
	var tempooffset = 0;
	var tempobase = 0;
	var timestamp = 0;
	var instrument = $("#instruments input[name=instrument]:checked").val(); 
	var chans = $("#channels input:checkbox").map(function() {
    	return !$(this).is(":checked");
    }).get();

    $("#write-btn").val("Cancel");

	while (!isFinished && connection != null)
	{
		var e = nextEvent();
		if (e == null) break;

		timestamp = (e.Time - tempobase) * tempo / midi.timeDivision / (1000000 / 85) + tempooffset;
		if (e.type == 0xFF) {
			if (e.metaType == 0x51) {
				tempooffset = timestamp;
				tempobase = e.Time;
				tempo = e.data;
			}
		}

		else if (e.type == 9) {
			var note = e.data[0];
			for (var i = 3; i < e.data[1]; i += 805) {
				if (timestamp <= offset) {
					offset++;
				} 
				else {
					offset = timestamp;
				}

				x = Math.floor(offset / distance + 2);
				y = Math.floor(offset % distance + 3);
				if (x >= BH.width - 2) {
					x = xprev; 
					break;
				}

				if (chans[e.channel]) {
					if (e.channel == 9) {
						if (note >= 35 && note <= 81) {
							BH.place(0, x, y, 83, percussion [note - 35]);
							break;
						}
					} 
					else {
	                    //C3 is note 48 in MIDI, and note 0 in EE
	                    if (instrument == 1 && note >= 40 && note < guitar.length + 40)
	                    {
	                        BH.place(0, x, y, 1520, guitar[note - 40]); //note - 48
	                    }
	                    else
	                    {
	                        BH.place(0, x, y, 77, note - 48);
	                    }
					}
				}
			}
		}

		if (x > xprev) {
			for (var i = xprev; i < x; ++i) {
				//Add in portals to the slack space
				BH.place(0, i, 2, 242, 1, id, id - 1);
				BH.place(0, i, worldHeight - 3, 242, 1, id + 1, id + 2);
				id += 2;
			}
		}
		xprev = x;
	}

	isFinished = true;
	BH.place(0, x, 2, 242, 1, id, id - 1);
	BH.place(0, x, worldHeight - 3, 242, 1, id + 1, 3);

	BH.onAllPlaced(function() {
		$("#write-btn").val("Write");
	});

	$("#file").prop("disabled", false);
}