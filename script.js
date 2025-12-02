// Initializing currency dropdowns and form events once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const fromSelect = document.getElementById('from');
    const toSelect = document.getElementById('to');
    const form = document.getElementById('currency-conversion');
    const resultElement = document.getElementById('result');
    const status = document.getElementById('status');
    const amountHint = document.getElementById('amount-hint');
    const swapBtn = document.getElementById('swap');
    // Tabs & live elements
    const tabConverter = document.getElementById('tab-converter');
    const tabLive = document.getElementById('tab-live');
    const converterSection = document.getElementById('converter-section');
    const liveSection = document.getElementById('live-section');
    const liveBase = document.getElementById('live-base');
    const liveTableBody = document.querySelector('#rates-table tbody');
    const liveStatus = document.getElementById('live-status');
    const liveUpdated = document.getElementById('live-updated');
    let liveIntervalId = null;
    let lastRates = null; // remember last fetched rates to detect changes
    const CHANGE_EPSILON = 0.00001; // higher sensitivity for tiny moves

    // Fetch available currencies and populate dropdowns (defaults from USD)
    status.textContent = 'Loading currencies…';
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
        .then(resp => resp.json())
        .then(data => {
            const currencies = Object.keys(data.rates);
            fromSelect.innerHTML = '';
            toSelect.innerHTML = '';
            if (liveBase) liveBase.innerHTML = '';
            currencies.forEach(curr => {
                const option1 = document.createElement('option');
                option1.value = curr;
                option1.textContent = curr;
                fromSelect.appendChild(option1);
                const option2 = document.createElement('option');
                option2.value = curr;
                option2.textContent = curr;
                toSelect.appendChild(option2);
                if (liveBase) {
                    const option3 = document.createElement('option');
                    option3.value = curr;
                    option3.textContent = curr;
                    liveBase.appendChild(option3);
                }
            });
            fromSelect.value = 'USD';
            toSelect.value = 'INR';
            if (liveBase) liveBase.value = 'USD';
            status.textContent = '';
        })
        .catch(err => {
            fromSelect.innerHTML = '<option value="USD">USD</option><option value="INR">INR</option>';
            toSelect.innerHTML = '<option value="USD">USD</option><option value="INR">INR</option>';
            if (liveBase) liveBase.innerHTML = '<option value="USD">USD</option>';
            status.textContent = 'Could not load currencies – defaults shown';
            console.error('Failed to load', err);
        });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        convert();
    });

    // Swap the selected currencies
    if (swapBtn) {
        swapBtn.addEventListener('click', () => {
            [fromSelect.value, toSelect.value] = [toSelect.value, fromSelect.value];
        });
    }

    // Tabs wiring
    function showConverter() {
        tabConverter.classList.add('active');
        tabLive.classList.remove('active');
        converterSection.classList.remove('hidden');
        liveSection.classList.add('hidden');
        // Keep live updates running in the background
    }

    function showLive() {
        tabLive.classList.add('active');
        tabConverter.classList.remove('active');
        liveSection.classList.remove('hidden');
        converterSection.classList.add('hidden');
        startLive();
    }

    if (tabConverter && tabLive) {
        tabConverter.addEventListener('click', showConverter);
        tabLive.addEventListener('click', showLive);
    }

    // Live rates logic
    function renderRatesTable(rates) {
        if (!liveTableBody) return;
        liveTableBody.innerHTML = '';
        // Show a subset of popular currencies at the top
        const popular = ['USD','EUR','GBP','INR','JPY','AUD','CAD','CHF','CNY','SGD'];
        const ordered = [...new Set([...popular, ...Object.keys(rates)])];
        ordered.forEach(code => {
            if (!rates[code]) return;
            const tr = document.createElement('tr');
            const tdCode = document.createElement('td');
            const tdRate = document.createElement('td');
            tdCode.textContent = code;
            const value = rates[code];
            tdRate.textContent = value.toFixed(5);
            // Remove any previous indicator (we will keep the latest one until next refresh)
            const oldIndicator = tdRate.querySelector('.change-indicator');
            if (oldIndicator) oldIndicator.remove();
            if (lastRates && lastRates[code] !== undefined) {
                const prev = lastRates[code];
                const diff = value - prev;
                if (Math.abs(diff) >= CHANGE_EPSILON) {
                    let indicator = null;
                    // Clear previous persistent state before applying new
                    tdRate.classList.remove('rate-up-persist','rate-down-persist','flash-up','flash-down');
                    if (diff > 0) {
                        tdRate.classList.add('rate-up-persist','flash-up');
                        indicator = document.createElement('span');
                        indicator.className = 'change-indicator';
                        indicator.textContent = '▲';
                    } else if (diff < 0) {
                        tdRate.classList.add('rate-down-persist','flash-down');
                        indicator = document.createElement('span');
                        indicator.className = 'change-indicator';
                        indicator.textContent = '▼';
                    }
                    if (indicator) {
                        tdRate.appendChild(indicator);
                        // keep arrow and persistent color; only clear flash background after a moment
                        setTimeout(() => {
                            tdRate.classList.remove('flash-up');
                            tdRate.classList.remove('flash-down');
                        }, 900);
                    }
                }
            }
            tr.appendChild(tdCode);
            tr.appendChild(tdRate);
            liveTableBody.appendChild(tr);
        });
        // snapshot for next comparison
        lastRates = { ...rates };
    }

    function fetchLive() {
        if (!liveBase) return;
        const base = liveBase.value || 'USD';
        liveStatus.textContent = 'Refreshing…';
        fetch(`https://api.exchangerate-api.com/v4/latest/${base}`)
            .then(resp => resp.json())
            .then(data => {
                renderRatesTable(data.rates || {});
                const dt = new Date();
                liveUpdated.textContent = `Updated ${dt.toLocaleTimeString()}`;
                liveStatus.textContent = '';
            })
            .catch(err => {
                liveStatus.textContent = 'Failed to load live rates';
                console.error(err);
            });
    }

    function startLive() {
        if (liveIntervalId) return;
        fetchLive();
        // Faster cadence for more "live" feel
        liveIntervalId = setInterval(fetchLive, 2000);
        if (liveBase) liveBase.addEventListener('change', fetchLive);
    }

    function stopLive() {
        if (liveIntervalId) {
            clearInterval(liveIntervalId);
            liveIntervalId = null;
        }
        if (liveBase) liveBase.removeEventListener('change', fetchLive);
    }

    // Default to Converter tab visible, but keep live running continuously
    showConverter();
    startLive();
});

// Convert the entered amount using the selected currency pair
function convert() {
    const amount = parseFloat(document.getElementById('amount').value);
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const resultElement = document.getElementById('result');
    const status = document.getElementById('status');
    const amountHint = document.getElementById('amount-hint');

    if (isNaN(amount) || amount <= 0) {
        amountHint.textContent = 'Enter a positive number';
        resultElement.textContent = '';
        return;
    }
    amountHint.textContent = '';
    status.textContent = 'Converting…';

    fetch(`https://api.exchangerate-api.com/v4/latest/${from}`)
        .then(resp => resp.json())
        .then(data => {
            const allRates = data.rates;
            const conversionRate = allRates[to];
            if (!conversionRate) {
                resultElement.textContent = 'Currency not supported';
                return;
            }
            const convertedAmount = amount * conversionRate;
            resultElement.textContent = `${convertedAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${to}`;
            status.textContent = '';
        })
        .catch(err => {
            resultElement.textContent = 'Conversion failed';
            status.textContent = '';
            console.error(err);
        });
}