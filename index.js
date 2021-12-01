var tcp = require('../../tcp')
var instance_skel = require('../../instance_skel')

function instance(system, id, config) {
	var self = this

	// super-constructor
	instance_skel.apply(this, arguments)

	self.actions() // export actions
	self.init_presets()

	return self
}

instance.prototype.updateConfig = function (config) {
	var self = this
	self.init_presets()

	if (self.udp !== undefined) {
		self.udp.destroy()
		delete self.udp
	}

	if (self.socket !== undefined) {
		self.socket.destroy()
		delete self.socket
	}

	self.config = config

	self.init_tcp()
}

instance.prototype.init = function () {
	var self = this

	self.init_presets()

	self.init_tcp()
}

instance.prototype.init_tcp = function () {
	var self = this

	if (self.socket !== undefined) {
		self.socket.destroy()
		delete self.socket
	}

	self.status(self.STATE_WARNING, 'Connecting')

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port)

		self.socket.on('status_change', function (status, message) {
			self.status(status, message)
		})

		self.socket.on('error', function (err) {
			self.debug('Network error', err)
			self.status(self.STATE_ERROR, err)
			self.log('error', 'Network error: ' + err.message)
		})

		self.socket.on('connect', function () {
			self.status(self.STATE_OK)
			self.debug('Connected')
		})

		self.socket.on('data', function (data) {
			self.log('error', 'data ' + data.toString())
		})
	}
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this

	return [
		{
			type: 'text',
			id: 'info',
			label: 'Information',
			width: 12,
			value: 'This module connects to the TunninS software',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			regex: self.REGEX_IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 2,
			default: 22222,
			regex: self.REGEX_PORT,
		},
	]
}

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this

	if (self.socket !== undefined) {
		self.socket.destroy()
	}

	self.debug('destroy', self.id)
}

instance.prototype.CHOICES_END = [
	{ id: '', label: 'None' },
	{ id: '\n', label: 'LF - \\n (Common UNIX/Mac)' },
	{ id: '\r\n', label: 'CRLF - \\r\\n (Common Windows)' },
	{ id: '\r', label: 'CR - \\r (Old MacOS)' },
	{ id: '\x00', label: 'NULL - \\x00 (Can happen)' },
	{ id: '\n\r', label: 'LFCR - \\n\\r (Just stupid)' },
]

instance.prototype.init_presets = function () {
	var self = this
	var presets = []

	self.setPresetDefinitions(presets)
}

instance.prototype.actions = function (system) {
	var self = this

	self.system.emit('instance_actions', self.id, {
		send: {
			label: 'Send Command',
			options: [
				{
					type: 'textinput',
					id: 'id_send',
					label: 'Command:',
					tooltip: 'Use %hh to insert Hex codes',
					default: '',
					width: 6,
				},
				{
					type: 'dropdown',
					id: 'id_end',
					label: 'Command End Character:',
					default: '\n',
					choices: self.CHOICES_END,
				},
			],
		},
	})
}

instance.prototype.action = function (action) {
	var self = this
	var cmd
	var end

	switch (action.action) {
		case 'send':
			cmd = unescape(action.options.id_send)
			end = action.options.id_end
			break
	}

	/*
	 * create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
	 * sending a string assumes 'utf8' encoding
	 * which then escapes character values over 0x7F
	 * and destroys the 'binary' content
	 */
	var sendBuf = Buffer.from(cmd + end, 'latin1')

	if (sendBuf != '') {
		self.debug('sending ', sendBuf, 'to', self.config.host)

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(sendBuf)
		} else {
			self.debug('Socket not connected :(')
		}
	}
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
