'use strict'

const config = require('../config')
const async = require('async')
const mongoose = require('mongoose')

function FlipManager(params) {
    this.currentflips = {}

    this.coinflipschema = new mongoose.Schema({
        steamid1: { type: String, required: true },
        steamid2: { type: String, required: true },
        serverseed: { type: String },
        clientseed: { type: String },
        hash: { type: String },
        date: { type: Date, default: Date.now, required: true }
    })

    this.coinflipmodel = mongoose.model('coinflip', coinflipschema)

    mongoose.connect('mongodb://localhost/coinflips')

    this.io = params.io || false
}

FlipManager.prototype.getCurrentFlips = function getCurrentFlips() {
    return this.currentflips
}

FlipManager.prototype.createNewFlip = function createNewFlip() {
    
}

FlipManager.prototype.storeFlipToDB = function storeFlipToDB() {
    
}



module.exports = FlipManager