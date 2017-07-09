$(function() {
    var app = new Vue({
        el: '#app',
        data: {
            coinflips: [
                { name1: 'Foo', name2: '', amount: '100.00', status: 'Awaiting Second Player' },
                { name1: 'Foo', name2: 'Bar', amount: '100.00', status: 'CT Win' }
            ],
            priceList: {},
            rates: {},
            disableReload: true,
            disableTrade: true,
            // bot
            selectedBot: 'All bots',
            botInventories: {},
            botInventory: [],
            botInventorySelected: [],
            botInventorySelectedValue: 0,
            // user
            userInventory: [],
            userInventorySelected: [],
            userInventorySelectedValue: 0,
            // auth
            user: false,
            // site
            site: {
                header: '',
                steamGroup: '#',
                copyrights: ''
            },
            // trade
            offerStatus: {},
            invalidTradelink: false
        },
        methods: {
            setInventorySort: function(who, value) {
                if(who == 'bot') {
                    this.botInventory = this.sortInventory(this.botInventory, value);
                } else {
                    this.userInventory = this.sortInventory(this.userInventory, value);
                }
            },
            sortInventory: function(inventory, desc) {
                return inventory.sort(function(a, b) {
                    if(desc) {
                        return b.price - a.price;
                    } else {
                        return a.price - b.price;
                    }
                });
            },
            addItem: function(who, id, assetid, price) {
                if(typeof price === 'undefined') {
                    price = assetid;
                    assetid = id;
                }
                if(who == 'bot') {
                    if(this.selectedBot !== id) {
                        this.activeBot(id);
                    }
                    var botInventorySelected = this.botInventorySelected;
                    botInventorySelected.push(assetid);
                    this.botInventorySelected = botInventorySelected;
                    this.botInventorySelectedValue += parseFloat(price);
                } else {
                    var userInventorySelected = this.userInventorySelected;
                    userInventorySelected.push(assetid);
                    this.userInventorySelected = userInventorySelected;
                    this.userInventorySelectedValue += parseFloat(price);
                }
                this.checkTradeable();
            },
            removeItem: function(who, id, assetid, price) {
                if(typeof price === 'undefined') {
                    price = assetid;
                    assetid = id;
                }
                if(who == 'bot') {
                    this.botInventorySelected.splice($.inArray(assetid, this.botInventorySelected),1);
                    this.botInventorySelectedValue -= price;
                } else {
                    this.userInventorySelected.splice($.inArray(assetid, this.userInventorySelected),1);
                    this.userInventorySelectedValue -= price;
                    if(this.userInventorySelectedValue <= 0) {
                        this.userInventorySelectedValue = 0;
                    }
                }
                this.checkTradeable();
            },
            checkTradeable: function() {
                var user = parseFloat(this.userInventorySelectedValue.toFixed(2));
                var bot = parseFloat(this.botInventorySelectedValue.toFixed(2));
                if(user != 0 && user >= bot) {
                    this.disableTrade = false;
                } else {
                    this.disableTrade = true;
                }
            },
            activeBot: function(id) {
                if(this.selectedBot !== id) {
                    if(id == 'All Bots') {
                        var botInventory = [];
                        for(var i in this.botInventories) {
                            var bot = this.botInventories[i];
                            for(var y in bot.items) {
                                var item = bot.items[y];
                                item.bot = i;
                                item.price = this.priceList[item.data.market_hash_name];
                                botInventory.push(item);
                            }
                        }
                        this.botInventory = sortInventory(botInventory, true);
                    } else {
                        this.botInventory = this.sortInventory(this.botInventories[id].items, true);
                    }
                    this.botInventorySelected = [];
                    this.botInventorySelectedValue = 0;
                    this.selectedBot = id;
                }
            },
            searchInventory: function(who, value) {
                var inventory = [];
                var search = [];
                if(who == 'bot') {
                    search = this.botInventory;
                } else {
                    search = this.userInventory;
                }
                for(var i in search) {
                    var item = search[i];
                    if(item.data.market_hash_name.toLowerCase().indexOf(value.toLowerCase()) === -1) {
                        item.hidden = 1;
                    } else {
                        item.hidden = 0;
                    }
                    inventory.push(item);
                }
                if(who == 'bot') {
                    this.botInventory = sortInventory(inventory, true);
                } else {
                    this.userInventory = sortInventory(inventory, true);
                }
            },
            updateTradelink: function() {
                var link = this.user.tradelink;
                if(typeof link !== 'undefined') {
                    link = link.trim();
                    if(
                        link.indexOf('steamcommunity.com/tradeoffer/new/') === -1 ||
                        link.indexOf('?partner=') === -1 ||
                        link.indexOf('&token=') === -1
                    ) {
                        this.invalidTradelink = true;
                    } else {
                        ga('send', 'updateTradelink', {
                            eventCategory: 'Trade',
                            eventAction: 'click',
                            eventLabel: this.user.tradelink
                        });
                        this.invalidTradelink = false;
                        localStorage.setItem(this.user.id, this.user.tradelink);
                        $('#tradelink').modal('hide');
                    }
                } else {
                    this.invalidTradelink = true;
                }

            },
            reloadInventories: function() {
                this.disableReload = true;
                this.botInventory = [];
                this.botInventorySelected = [];
                this.botInventorySelectedValue = 0;
                this.userInventory = [];
                this.userInventorySelected = [];
                this.userInventorySelectedValue = 0;
                socket.emit('get bots inv');
                if(this.user && typeof this.user.steamID64 !== 'undefined') {
                    socket.emit('get user inv', this.user.steamID64);
                }
                ga('send', 'reloadInventories', {
                    eventCategory: 'Trade',
                    eventAction: 'click',
                    eventLabel: this.user.steamID64 || false
                });
            },
            sendOffer: function() {
                if( ! localStorage[this.user.id]) {
                    $('#tradelink').modal('show');
                } else {
                    ga('send', 'sendOffer', {
                        eventCategory: 'Trade',
                        eventAction: 'click',
                        eventLabel: this.user.id
                    });
                    this.offerStatus = {};
                    this.checkTradeable();
                    if( ! this.disableTrade) {
                        this.disableTrade = true;
                        $('#tradeoffer').modal('show');
                        socket.emit('get offer', {
                            user: this.userInventorySelected,
                            bot: this.botInventorySelected,
                            bot_id: this.selectedBot,
                            steamID64: this.user.id,
                            tradelink: localStorage[this.user.id]
                        });
                    }
                }
            }
        }
    });

	$(window).on("load",function(){
				
		/* call mCustomScrollbar function before jquery ui resizable() */
				
		$(".content").mCustomScrollbar({
		});
	});

    // Sockets
    var socket = io();

    socket.emit('get pricelist');
    socket.emit('get rates');
    socket.emit('get coinflips');

	$('#chatboxsendbutton').submit(function(){
        if(app.user.displayName) {
            var msg = {
                name: app.user.displayName,
                pic: app.user.photos[1].value,
                message: $('#m').val()
            }

            socket.emit('chat message', msg);
            $('#m').val('');
            return false;
        } else {
            $('#mCSB_1_container').append($('<p>').html('<hr>'));
            $('#mCSB_1_container').append($('<p>').html('<strong>Log in with Steam to use the chat.</strong>'));
            $('#m').val('');
            $('.content').mCustomScrollbar('scrollTo','last');
            return false;
        }
	});

    socket.on('chat message', function(msg){
        $('#mCSB_1_container').append($('<p>').html("<hr><img src=" + msg.pic + " class='chatpic'>"));
		$('#mCSB_1_container').append($('<p>').text(msg.name + ': ' + msg.message));
		$('.content').mCustomScrollbar('scrollTo','last');
	});

    socket.on('site', function(data) {
        app.site = data;
        window.document.title = data.header + ' | CS:GO Gambling Evolved';
    });

    socket.on('offer status', function(data) {
        app.offerStatus = data;
        if(data.status === 3 || data.status === false) {
            app.disableTrade = false;
        }
        if(data.status === 3) {
            app.botInventorySelected = [];
            app.botInventorySelectedValue = 0;
            app.userInventorySelected = [];
            app.userInventorySelectedValue = 0;
        }
    });

    socket.on('user', function(user) {
        user.steamID64 = user.id;
        app.user = user;

        if(app.user.steamID64) {
            socket.emit('get user inv', app.user.steamID64);
        }
    });

    socket.on('user inv', function(data) {
        app.disableReload = false;
        if( ! data.error) {
            var userInventory = [];
            for(var i in data.items) {
                var item = data.items[i];
                item.price = (app.priceList[item.data.market_hash_name]).toFixed(2);
                userInventory.push(item);
            }
            if( ! userInventory.length) {
                userInventory = { error: { error: 'No tradeable items found.' } };
            } else {
                userInventory = sortInventory(userInventory, true);
            }
            app.userInventory = userInventory;
        } else {
            app.userInventory = data;
        }
    });

    socket.on('pricelist', function(prices) {
        app.priceList = Object.assign({}, app.priceList, prices);
    });

    socket.on('rates', function(rates) {
        app.rates = Object.assign({}, app.rates, rates);
    });

    socket.on('current flips', function(coinflips) {
        app.coinflips = Object.assign({}, app.coinflips, coinflips);
    });

    function sortInventory(inventory, desc) {
        return inventory.sort(function(a, b) {
            return (desc) ? b.price - a.price : a.price - b.price;
        });
    }

});
