(function () {
    // Set target to May 16, 2026, 09:00:00 IST
    var target = new Date(2026, 4, 16, 9, 0, 0);

    // Fallback/Validation
    if (isNaN(target.getTime())) {
        target = new Date(Date.UTC(2026, 4, 16, 3, 30, 0));
    }

    var daysEl = document.getElementById('countdown-days');
    var hoursEl = document.getElementById('countdown-hours');
    var minutesEl = document.getElementById('countdown-minutes');
    var secondsEl = document.getElementById('countdown-seconds');

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
        console.warn("Countdown elements not found.");
        return;
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function updateCountdown() {
        var now = new Date();
        var diff = target.getTime() - now.getTime();

        if (diff <= 0) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            clearInterval(timerId);
            return;
        }

        var totalSeconds = Math.floor(diff / 1000);
        var days = Math.floor(totalSeconds / 86400);
        var hours = Math.floor((totalSeconds % 86400) / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;

        daysEl.textContent = pad(days);
        hoursEl.textContent = pad(hours);
        minutesEl.textContent = pad(minutes);
        secondsEl.textContent = pad(seconds);
    }

    var timerId = setInterval(updateCountdown, 1000);
    updateCountdown();
})();
