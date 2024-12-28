function calculateTimeDifference(time1, time2) {

	const [h1, m1, s1] = time1.split(":").map(Number);
	const [h2, m2, s2] = time2.split(":").map(Number);

	const time1InSeconds = h1 * 3600 + m1 * 60 + s1;
	const time2InSeconds = h2 * 3600 + m2 * 60 + s2;
	console.log('times', time1InSeconds, time2InSeconds);

	

	let differenceInSeconds = Math.abs(time2InSeconds - time1InSeconds);
	const hours = Math.floor(differenceInSeconds / 3600);
	differenceInSeconds %= 3600;
	const minutes = Math.floor(differenceInSeconds / 60);
	const seconds = differenceInSeconds % 60;

	
	return time2 === '00:00:00'
		? '00:00:00'
		: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function convertDate(hour) {
	if (hour === '--:--:--') {
		return '00:00:00';
	} else {
		const hourISO = hour;
		const now = new Date().toISOString().split("T")[0];
		const dateISO = `${now}T${hourISO}Z`;
		const date = new Date(dateISO);
		const hourLocal = date.toLocaleTimeString('es-ES',{hour12:false});
		console.log('hourLocal', hourLocal);
		return hourLocal;
		
	}
}

module.exports = {
	calculateTimeDifference, convertDate
};