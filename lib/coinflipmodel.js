var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var coinflipSchema = new Schema({
    csteamid: { type: Number },
    jsteamid: { type: Number },
    commission: { type: Number },
    date: { type: Date, default: Date.now, required: true }
})

coinflipSchema.methods.savePrint = function () {
    console.log('[!]' + this.date + ' - Saving commissioned flip with ' + this.csteamid + ' and ' + this.jsteamid + ' for amount: $' + this.commission);
}

module.exports = mongoose.model('Coinflip', coinflipSchema);