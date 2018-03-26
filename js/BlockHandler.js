function BlockHandler(con, botID, width, height, BPS, msg) {
	// Constants
	const PIOtypes = {
		Int: 0,
		UInt: 1,
		Long: 2,
		ULong: 3,
		Double: 4,
		Float: 5,
		String: 6,
		ByteArray: 7,
		Bool: 8
	};
	const delay = 25;
	
	// Properties
	this.con = con;
	this.botID = botID;
	this.BPS = (typeof BPS !== 'undefined') ? BPS : 100;
	this.width = width;
	this.height = height;
	this.blocks = [ ];
	for (var x = 0; x < this.width; x++) {
		this.blocks[x] = [ ];
		for (var y = 0; y < this.height; y++) {
			this.blocks[x][y] = [{id:0, args:[ ]}, {id:0, args:[ ]}];
		}
	}
	this.blockQueue = [ ];
	this.blockPlaces = { };
	this.callbacks = [ ];
	this.placingBlocks = false;
	this.stopping = 0;
	this.paused = 0;
	this.nextBlockPlace = 0;
	this.blockPlace = { pos: [-1, -1, -1], block: undefined };
	
	// Private functions
	var blockPlaceTick = function(BH) {
		if (BH.stopping > 0) { BH.stopping--; return; }
		while (new Date().getTime() >= BH.nextBlockPlace) {
			if (BH.blockQueue.length == 0) { BH.placingBlocks = false; callback(BH); return; }
			BH.nextBlockPlace += (1000 / BH.BPS);
			BH.blockPlaces[BH.blockQueue[0].slice(0, 3).join(',')][0] = undefined;
			BH.blockPlaces[BH.blockQueue[0].slice(0, 3).join(',')][1].push(BH.blockQueue[0].slice(3));
			BH.con.send.apply(BH.con, ['b'].concat(BH.blockQueue.shift()));
		}
		
		setTimeout(function() { blockPlaceTick(BH) }, delay);
	};
	var arraysEqual = function(arr1, arr2) {
		if (arr1.length !== arr2.length) return false;
		for (var i = 0; i < arr1.length; i++) {
			if (arr1[i] !== arr2[i]) return false;
		}
		return true;
	};
	var callback = function(BH) {
		while (BH.callbacks.length > 0) BH.callbacks.shift()();
	};
	
	// Public Functions
	this.message = function(msg, type) {
		if (type == 'serialised') {
			for (var x = 0; x < this.width; x++)
				for (var y = 0; y < this.height; y++)
					this.blocks[x][y] = [{id:0, args:[]}, {id:0, args:[]}];
			
			var objects = msg._internal_('get-objects');
			var types = msg._internal_('get-types');
			
			var i = 0;
			while (objects[i++] !== 'ws');
			while (objects[i] !== 'we') {
				var id = objects[i++];
				var l = objects[i++];
				var xs = objects[i++];
				var ys = objects[i++];
				var args = [];
				
				while(objects[i] !== "we" &&
					!(types[i  ] == PIOtypes.UInt &&
						types[i+1] == PIOtypes.Int &&
						types[i+2] == PIOtypes.ByteArray &&
						types[i+3] == PIOtypes.ByteArray))
					args.push(objects[i++]);
				
				for (var p = 0; p+1 < xs.length; p+=2)
					this.blocks[(xs[p]<<8) + xs[p+1]][(ys[p]<<8) + ys[p+1]][l] = {id:id, args:args};
			}
		} else if (type == 'clear') {
			var cloneBlock = b => [b[0], b[1]];
			for (var y = 0; y < this.height; y++) {
				for (var x = 0; x < this.width; x++) {
					if (x == 0 || y == 0 || x == this.width - 1 || y == this.height - 1) this.blocks[x][y] = cloneBlock(arguments[2]);
					else this.blocks[x][y] = cloneBlock(arguments[3]);
				}
			}
		} else if (type == 'block') {
			var objects = msg._internal_('get-objects');
			
			var args = [ ];
			var id = 0;
			var l = 0;
			var x = 0;
			var y = 0;
			var pid = 0;
			
			var i1 = -3;
			for (var i2 = 0; i2 < msg.length; i2++) {
				if (i2 === arguments[2]) {
					l = objects[i2];
					continue;
				}
				
				if (i1 == -3) {
					x = objects[i2];
				} else if (i1 == -2) {
					y = objects[i2];
				} else if (i1 == -1) {
					id = objects[i2];
				} else if (i2 == msg.length - 1) {
					pid = objects[i2];
				} else {
					args[i1] = objects[i2];
				}
				
				i1++;
			}
			
			this.blockPlace = {pos: [l, x, y], block: {id:id, args:args}};
			var pos = l+','+x+','+y;
			if (!(pos in this.blockPlaces)) {
				if (arguments[3]) arguments[3](pid, l, x, y, id, args);
				if (this.blockPlace != true) this.blocks[x][y][l] = this.blockPlace.block;
			} else if (this.blockPlaces[pos][1].length > 0 && arraysEqual(this.blockPlaces[pos][1][0], [id].concat(args))) {
				this.blockPlaces[pos][1].shift();
				if (this.blockPlaces[pos][1].length == 0 && this.blockPlaces[pos][0] == undefined) {
					delete this.blockPlaces[pos];
					if (arguments[3]) arguments[3](pid, l, x, y, id, args);
				}
			} else {
				if (this.blockPlaces[pos][0] != undefined) {
					this.blockQueue.splice(this.blockQueue.findIndex(b => b[0] == l && b[1] == x && b[2] == y), 1);
					if (this.blockPlaces[pos][1].length == 0) {
						delete this.blockPlaces[pos];
						if (arguments[3]) arguments[3](pid, l, x, y, id, args);
						if (this.blockPlace != true) this.blocks[x][y][l] = this.blockPlace.block;
					} else this.blockPlaces[pos][0] = undefined;
				}
			}
			this.blockPlace = { pos: [-1, -1, -1], block: undefined };
		}
	};
	this.place = function(l, x, y, id) {
		if (this.blockPlace != true && arraysEqual(this.blockPlace.pos, [l, x, y])) {
			this.blocks[x][y][l] = this.blockPlace.block;
			this.blockPlace = true;
		}
		if (this.blocks[x][y][l].id != id || !arraysEqual(this.blocks[x][y][l].args, Array.from(arguments).slice(4))) {
			if (!this.blockPlaces[l+','+x+','+y]) this.blockPlaces[l+','+x+','+y] = [this.blocks[x][y][l], []];
			else if (!this.blockPlaces[l+','+x+','+y][0]) this.blockPlaces[l+','+x+','+y][0] = this.blocks[x][y][l];
			else {
				var index = this.blockQueue.findIndex(b => arraysEqual(b.slice(0, 3), [l, x, y]));
				if (arraysEqual(this.blockQueue[index], Array.from(arguments))) return;
				this.blockQueue.splice(index, 1);
				if (this.blockPlaces[l+','+x+','+y][0].id == id && arraysEqual(this.blockPlaces[l+','+x+','+y][0].args, Array.from(arguments).slice(4))) {
					this.blocks[x][y][l] = this.blockPlaces[l+','+x+','+y][0];
					if (this.blockPlaces[l+','+x+','+y][1].length == 0) delete this.blockPlaces[l+','+x+','+y];
					else this.blockPlaces[l+','+x+','+y][0] = undefined;
					return;
				}
			}
			
			this.blockQueue.push(Array.from(arguments));
			this.blocks[x][y][l] = {id:id, args:Array.from(arguments).slice(4)};
			if (!this.placingBlocks) {
				this.placingBlocks = true;
				this.nextBlockPlace = new Date().getTime() + (1000 / this.BPS);
				var BH = this;
				setTimeout(function() { blockPlaceTick(BH) }, delay);
			}
		}
	};
	this.pause = function() {
		if (this.paused == 0) this.stopping++;
		this.paused++;
	};
	this.resume = function() {
		if (--this.paused == 0) {
			this.nextBlockPlace = new Date().getTime() + (1000 / this.BPS);
			blockPlaceTick(this);
		}
	};
	this.clearQueue = function() {
		this.blockQueue = [ ];
		for (var pos in this.blockPlaces) {
			if (this.blockPlaces[pos][0]) {
				var splitPos = pos.split(',').map(c => Number(c));
				this.blocks[splitPos[1]][splitPos[2]][splitPos[0]] = this.blockPlaces[pos][0];
			}
			delete this.blockPlaces[pos];
		}
		callback(this);
	};
	this.onAllPlaced = function(cback) {
		if (this.placingBlocks) this.callbacks.push(cback);
		else cback(this);
	};
	
	// Deserialise world
	if (msg) this.message(msg, 'serialised');
}

// BlockHandler.js Version 1.4 (by Destroyer123)