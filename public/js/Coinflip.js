jQuery(document).ready(function($){

var spinArray = ['animation1260','animation1440'];

function getSpin() {
var spin = spinArray[Math.floor(Math.random()*spinArray.length)];
return spin;
}

$('#coin').on('click', function(){
	$('#coin').removeClass();

	setTimeout(function(){
		$('#coin').addClass(getSpin());
	}, 100);
});

// Delete Me

setTimeout(function() {
	document.getElementById("coin").addEventListener("click", function() {
		setTimeout(function(){
			$('#coin').addClass(getSpin());
		}, 100);
	});
}, 2000);

});