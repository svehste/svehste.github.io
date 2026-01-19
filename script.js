function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element id="${id}" in this page`);
  return node;
}


let energyChart; // Global variable to store the chart instance

// Function to fetch the energy price from hvakosterstrommen.no API. This function will also draw the chart and update the traffic light.
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
            // Find the price for each hour and update the chart. Use time_start as x-axis and NOK_per_kWh as y-axis.
            const energyPrices = data.map(item => {
                const prices = calculatePrice(item.NOK_per_kWh);
                return {
                    time: item.time_start,
                    price: prices.inklNettleige
                };
            });

            const woodPrice = getWoodPrice(); // Get the wood price
    
            // Calculate the price for the heat pump
            const heatpumpEfficiency = heatpumpCOP();
            const heatpumpPrices = data.map(item => {
                const prices = calculatePrice(item.NOK_per_kWh);
                return {
                    time: item.time_start,
                    price: prices.heatpumpPrice 
                };
            });
            drawChart(energyPrices, woodPrice, currentHour, heatpumpPrices); // Draw the chart with fetched data
    
            // Find the price for the current hour. Using Date.getTime() to compare the time_start and time_end with the current time to ensure the correct format.
            const currentHourPrice = data.find(item => {
                const startTime = new Date(item.time_start).getTime();
                const endTime = new Date(item.time_end).getTime();
                const currentTimeMs = new Date(currentTime).getTime();
                return currentTimeMs >= startTime && currentTimeMs < endTime;
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

    let subsidizedPrice; //To check if the price is over the treshold for subsidizing.
    if (exVatPrice > 0.75) {
        const subsidizeBase = exVatPrice - 0.75;
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
    let nettleige;

    if (month >= 1 && month <= 3) {
        if (currentHour >= startHour && currentHour < endHour) {
            inklNettleige = adjustedPrice + janMarDay;
            nettleige = janMarDay;
        } else {
            inklNettleige = adjustedPrice + janMarNight;
            nettleige = janMarNight;
        }
    } else if (month >= 4 && month <= 12) {
        if (currentHour >= startHour && currentHour < endHour) {
            inklNettleige = adjustedPrice + aprDesDay;
            nettleige = aprDesDay;
        } else {
            inklNettleige = adjustedPrice + aprDesNight;
            nettleige = aprDesNight;
        }
    }


    const heatpumpPrice = (adjustedPrice / heatpumpCOP()) + nettleige; //Calculate the price of the heat pump

    //Display the different prices on the web page. 
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
    document.getElementById('exVatPrice').textContent = exVatPrice.toFixed(2);
    document.getElementById('subsidizedPrice').textContent = subsidizedPrice.toFixed(2);
    document.getElementById('adjustedPrice').textContent = adjustedPrice.toFixed(2);
    updateInklNettleige(inklNettleige);
    updateHeatpumpPrice(heatpumpPrice);

    return {inklNettleige, heatpumpPrice};
}

// Function to update all elements with the class 'inklNettleige'
function updateInklNettleige(value) {
    const elements = document.querySelectorAll('.inklNettleige');
    elements.forEach(element => {
        element.textContent = value.toFixed(2);
    });
}

// Function to update all elements with the class 'inklNettleige'
function updateHeatpumpPrice(value) {
    const elements = document.querySelectorAll('.heatpumpPrice');
    elements.forEach(element => {
        element.textContent = value.toFixed(2);
    });
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

    const {inklNettleige} = calculatePrice(price); //Calculate the electricity price. The brackets to extract the inklNettleige value, since calculatePrice returns heatpumpPrice as well.
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

/// Function for drawing the chart
function drawChart(energyPrices, woodPrice, currentHour, heatpumpPrices) {
    // If the chart already exists, it needs to be reset
    if (energyChart) { 
        energyChart.destroy(); 
    }
    const ctx = document.getElementById('energyChart').getContext('2d');
    energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => i), // Labels from 0 to 23
            datasets: [{
                label: 'Straumpris inkl. nettleige (NOK/kWh)',
                data: energyPrices.map(item => item.price), // Extract price values
                borderColor: 'blue',
                fill: false
            }, {
                label: 'Vedprisen (NOK/kWh)',
                data: Array(24).fill(woodPrice),
                borderColor: 'green',
                fill: false
            },{
                label: 'Estimert varmepumpepris (NOK/kWh)',
                data: heatpumpPrices.map(item => item.price), // Extract price values
                borderColor: 'red',
                fill: false
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Timar i døgnet'
                    },
                    ticks: {
                        stepSize: 1 // Show hours starting at 0 and ending at 23.
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Prisen (NOK/kWh)'
                    }
                },
            }
        }
    });
}

function heatpumpCOP() {

    const outsideTemp = document.getElementById('outsideTemp').value;
    let COP; //Coefficient of performance for the heat pump

    if (outsideTemp >= 0) {
        COP = 4.8;
    } else if (outsideTemp < 0 && outsideTemp >= -4) {
        COP = 4.1;
    } else if (outsideTemp < -4 && outsideTemp >= -7) {
        COP = 3.1;
    } else if (outsideTemp < -7 && outsideTemp >= -10) {
        COP = 2.5;
    } else if (outsideTemp < -10 && outsideTemp >= -15) {
        COP = 2.3;
    } else {
        COP = 1.6;
    }

    document.getElementById('heatpumpCOP').textContent = COP.toFixed(2);

    return COP;
}

// Function to fetch the temperature on your longitude and latitude
function getTemperature() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const currentHour = `${year}-${month}-${day}T${hour}:00:00Z`; // Format current time to match the API response
  

    console.log("Current hour:", currentHour); 
    
    //Use the builtin geolocation api in the browser to find the longitude and latitude
    navigator.geolocation.getCurrentPosition(position => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

    //If the geolocation yields an undefined value, use the default values for Bergen. Error handling for the geolocation is done further down, but this fixes a bug with undefined values. 
        if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
            console.error("Latitude or longitude is undefined. Using default values for Bergen.");
            latitude = 61.4;
            longitude = 5.4;
        }
        console.log("Latitude:", latitude);
        console.log("Longitude:",longitude);

        // Proceed with fetching the temperature using the latitude and longitude
        const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`;
    
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const currentHour = new Date().toISOString().slice(0, 13) + ":00:00Z"; // Format current time to match the API response
                const currentHourData = data.properties.timeseries.find(item => item.time === currentHour); // Find the data for the current hour
                if (currentHourData) {
                    const temperature = currentHourData.data.instant.details.air_temperature;
                    console.log("Temperature:", temperature);
                    document.getElementById('outsideTemp').value = temperature; // Update the temperature input field
                    getEnergyPrice(); // Fetch the energy price after updating the temperature
                } else {
                    console.error("No matching data found for the current hour.");
                }
            })
            .catch(error => {
                console.error("Error fetching data from API:", error);
            });
    
            //If the geolocation fails, use the default values for Bergen and fetch the temperature using met.no API. Same as above. 
    }, error => {
        console.error("Error getting location:", error);
        // Use default location if geolocation fails
        const latitude = 61.4;
        const longitude = 5.4;
        console.log("Latitude:", latitude);
        console.log("Longitude:",longitude);

        // Proceed with fetching the temperature using the default latitude and longitude
        const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`;
    
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const currentHour = new Date().toISOString().slice(0, 13) + ":00:00Z"; // Format current time to match the API response
                const currentHourData = data.properties.timeseries.find(item => item.time === currentHour);
                if (currentHourData) {
                    const temperature = currentHourData.data.instant.details.air_temperature;
                    console.log("Temperature:", temperature);
                    document.getElementById('outsideTemp').value = temperature;
                    getEnergyPrice();
                } else {
                    console.error("No matching data found for the current hour.");
                }
            })
            .catch(error => {
                console.error("Error fetching data from API:", error);
            });
    });
}

// Call the updateCurrentHour and getEnergyPrice function when the page loads
window.onload = function() { 
    getEnergyPrice();
};
