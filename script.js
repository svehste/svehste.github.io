// Function to fetch the energy price from Tibber API using GraphQL
function getEnergyPrice() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const currentTime = now.toISOString();

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


// Function to update the traffic light color based on the price
function updateTrafficLight(price) {
    // Turn off all lights and remove text
    document.getElementById('red').style.backgroundColor = '#333';
    document.getElementById('yellow').style.backgroundColor = '#333';
    document.getElementById('green').style.backgroundColor = '#333';
    document.getElementById('red-text').style.display = 'none';
    document.getElementById('yellow-text').style.display = 'none';
    document.getElementById('green-text').style.display = 'none'; 

    //Formula for calculation: (Spotpris uten mva. pr time i ditt prisområde - 73 øre) x 0,90 (strømstøtte i prosent) x 1,25 (mva.)

    //The API is fetching the price witout VAT. I make this const to display it on the webpage.
    const exVatPrice = price;

    // Calculating the price including VAT.
    const totalPrice = (exVatPrice * 1.25);

    //Handling if the price is below the threshold for subsizing (0.73). 
    let subsidizeBase;
    let subsidizedPrice;
    if (exVatPrice > 0.73) {
        subsidizeBase = exVatPrice - 0.73;
        subsidizedPrice = subsidizeBase * 0.9 * 1.25; //The state only subsidizes 90% of the price, and we add the VAT again. 
    } else {
        subsidizedPrice = 0 // No subsidy if the price is below the threshold
    }
    //Find the new and adjusted price
    const adjustedPrice = totalPrice - subsidizedPrice;

    // The net rent has one price from january to march, and one price from april to december. It also varies by time of day. It is cheeper at night. 
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentHour = now.getHours();
    const startHour = 7;
    const endHour = 22;
    let inklNettleige;

    //This section is for the calculation of net-rent. There are several companies. 
    const company = document.getElementById('company').value;

    if (company === "Eviny") {
        if (month >= 1 && month <= 3) {
            if (currentHour >= startHour && currentHour < endHour) {
                inklNettleige = adjustedPrice + 0.5025; //Day
            } else {
                inklNettleige = adjustedPrice + 0.3786; //Night
            } 
        } else if (month >= 4 && month <= 12) {
            if (currentHour >= startHour && currentHour < endHour) {
                inklNettleige = adjustedPrice + 0.5925; //Day
            } else {
                inklNettleige = adjustedPrice + 0.4652; //Night
            } 
        }
    }

    //To display on the web page
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);;
    document.getElementById('exVatPrice').textContent = exVatPrice.toFixed(2);;
    document.getElementById('subsidizedPrice').textContent = subsidizedPrice.toFixed(2);;
    document.getElementById('adjustedPrice').textContent = adjustedPrice.toFixed(2);
    document.getElementById('inklNettleige').textContent = inklNettleige.toFixed(2);

    // Determine the light color based on the price
    const lumberPrice = document.getElementById('lumberPrice').value;
    

    if (inklNettleige >= lumberPrice) {
        document.getElementById('green').style.backgroundColor = 'green';
        document.getElementById('green-text').style.display = 'block';
    } else if (lumberPrice >= inklNettleige * 1.10) {
        document.getElementById('red').style.backgroundColor = 'red';
        document.getElementById('red-text').style.display = 'block';
    } else {
        document.getElementById('yellow').style.backgroundColor = 'yellow';
        document.getElementById('yellow-text').style.display = 'block';
    }
    
}

// Call the getEnergyPrice function when the page loads
window.onload = getEnergyPrice;



