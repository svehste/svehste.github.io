let energyChart; // Global variable to store the chart instance

// Function to fetch the energy price from Tibber API using GraphQL
function getEnergyPrice() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const currentTime = now.toISOString();
    const currentHour = now.getHours();

    const priceArea = document.getElementById('price-area').value;
    const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${priceArea}.json`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Find the price for each hour and update the chart
            const energyPrices = data.map(item => calculatePrice(item.NOK_per_kWh));
            const woodPrice = getWoodPrice(); // Get the wood price

            drawChart(energyPrices, woodPrice, currentHour); // Draw the chart with fetched data

            // Find the price for the current hour
            const currentHourPrice = data.find(item => {
                return currentTime >= item.time_start && currentTime < item.time_end;
            });

            if (currentHourPrice) {
                const price = currentHourPrice.NOK_per_kWh;
                updateTrafficLight(price);
            } else {
                console.error("No matching price found for the current hour.");
            }
        })
        .catch(error => {
            console.error("Error fetching data from API:", error);
        });
}

// Function to calculate the price of the wood. Source: https://www.norskved.no/slik-beregner-du-energiprisen-for-vedfyring
function getWoodPrice(){
    const weight = document.getElementById('volume').value;
    const purchasePrice = document.getElementById('purchasePrice').value;
    const efficiency = document.getElementById('efficiency').value; 

    const woodPrice = purchasePrice / ((4.32 * weight) * (efficiency / 100));
    document.getElementById('woodPrice').textContent = woodPrice.toFixed(2);

    return woodPrice;
}

function calculatePrice(price) {
    const exVatPrice = price; //Must be made into a const in order to display it on the webpage
    const totalPrice = exVatPrice * 1.25; //The price including VAT

    let subsidizedPrice; //To check if the price is over the threshold for subsidizing.
    if (exVatPrice > 0.73) {
        const subsidizeBase = exVatPrice - 0.73;
        subsidizedPrice = subsidizeBase * 0.9 * 1.25;
    } else {
        subsidizedPrice = 0;
    }

    const adjustedPrice = totalPrice - subsidizedPrice;

    //Adding the net-rent. Price is different depending on month and time of day. 
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentHour = now.getHours();
    const startHour = 7;
    const endHour = 22;

    const company = document.getElementById('company').value; //Get which company the user has selected. 

    let janMarDay, janMarNight, aprDesDay, aprDesNight;

    if (company === 'Eviny') {
        janMarDay = 0.5025;
        janMarNight = 0.3786;
        aprDesDay = 0.5925;
        aprDesNight = 0.4652;
    } else if (company === 'Glitre') {
        janMarDay = 0.4469;
        janMarNight = 0.3269;
        aprDesDay = 0.5300;
        aprDesNight = 0.4100;
    }

    let inklNettleige;

    if (month >= 1 && month <= 3) {
        if (currentHour >= startHour && currentHour < endHour) {
            inklNettleige = adjustedPrice + janMarDay;
        } else {
            inklNettleige = adjustedPrice + janMarNight;
        }
    } else if (month >= 4 && month <= 12) {
        if (currentHour >= startHour && currentHour < endHour) {
            inklNettleige = adjustedPrice + aprDesDay;
        } else {
            inklNettleige = adjustedPrice + aprDesNight;
        }
    }
    //Display the different prices on the web page. 
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
    document.getElementById('exVatPrice').textContent = exVatPrice.toFixed(2);
    document.getElementById('subsidizedPrice').textContent = subsidizedPrice.toFixed(2);
    document.getElementById('adjustedPrice').textContent = adjustedPrice.toFixed(2);
    document.getElementById('inklNettleige').textContent = inklNettleige.toFixed(2);

    return inklNettleige;
}

// Function to update the traffic light color based on the price
function updateTrafficLight(price) {
    //Remove all text and colors
    document.getElementById('red').style.backgroundColor = '#333';
    document.getElementById('yellow').style.backgroundColor = '#333';
    document.getElementById('green').style.backgroundColor = '#333';
    document.getElementById('red-text').style.display = 'none';
    document.getElementById('yellow-text').style.display = 'none';
    document.getElementById('green-text').style.display = 'none';

    const inklNettleige = calculatePrice(price); //Calculate the electricity price
    const woodPrice = getWoodPrice(); //Calculate the price of wood

    if (inklNettleige >= woodPrice) {
        document.getElementById('green').style.backgroundColor = 'green';
        document.getElementById('green-text').style.display = 'block';
    } else if (woodPrice >= inklNettleige * 1.10) {
        document.getElementById('red').style.backgroundColor = 'red';
        document.getElementById('red-text').style.display = 'block';
    } else {
        document.getElementById('yellow').style.backgroundColor = 'yellow';
        document.getElementById('yellow-text').style.display = 'block';
    }
}

//Function for drawing the chart
function drawChart(energyPrices, woodPrice, currentHour) {
    //If the chart already exists, it needs to be reset
    if (energyChart) { 
        energyChart.destroy(); 
    }
    const ctx = document.getElementById('energyChart').getContext('2d');
    energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => (i + 1).toString()), 
            datasets: [{
                label: 'Straumpris inkl. nettleige (NOK/kWh)',
                data: energyPrices,
                borderColor: 'blue',
                fill: false
            }, {
                label: 'Vedprisen (NOK/kWh)',
                data: Array(24).fill(woodPrice),
                borderColor: 'green',
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Timar i døgnet'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Prisen (NOK/kWh)'
                    }
                },
                plugins: {
                    annotation: { 
                        annotations: { 
                            currentHourLine: { 
                                type: 'line', 
                                xMin: currentHour + 1, 
                                xMax: currentHour + 1, 
                                borderColor: 'red', 
                                borderWidth: 2, 
                                label: { 
                                    content: 'Current Hour', 
                                    enabled: true, 
                                    position: 'top' 
                                } 
                            } 
                        } 
                    }
                }
            }
        }
    });
}

// Call the getEnergyPrice function when the page loads
window.onload = function() { 
    getEnergyPrice(); 
};