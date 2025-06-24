document.addEventListener('DOMContentLoaded', function() {
    const eventList = document.querySelector('.event-list');
    const loadingMessage = document.getElementById('events-loading-message');
    const DEFAULT_GOOGLE_LOCATION = "801 West South Street, Ozark, MO 65721";


    // Helper function to get the timezone offset for Ozark, MO for a given date
    function getOzarkTimezoneOffset(dateStr) {
        // Create a Date object from the local string to determine its local offset
        const testDate = new Date(dateStr);
        if (isNaN(testDate.getTime())) {
            console.error("Invalid date string for offset calculation:", dateStr);
            return null;
        }

        // The Date object will automatically know if it's DST for its *local* timezone.
        // We'll assume the browser's local timezone matches Ozark's.
        const offsetMinutes = testDate.getTimezoneOffset(); // Returns minutes difference from UTC (negative for US timezones)

        // Convert minutes to HH:MM format (e.g., -360 minutes -> -06:00)
        const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
        const offsetRemainderMinutes = Math.abs(offsetMinutes % 60);
        const sign = offsetMinutes > 0 ? '+' : '-'; // If offsetMinutes is positive, local is ahead of UTC

        return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetRemainderMinutes).padStart(2, '0')}`;
    }

    function formatLocalForGoogleCalendar(localDateTimeStr) {
        const date = new Date(localDateTimeStr);
        if (isNaN(date.getTime())) {
            console.error("Invalid date string provided:", localDateTimeStr);
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    // Function to calculate end time if not explicitly provided
    function calculateEndTime(startTimeLocal, durationHours = 1) {
        const start = new Date(startTimeLocal);
        start.setHours(start.getHours() + durationHours); // Add duration to local time
        // Return in YYYY-MM-DDTHH:MM:SS format for further processing
        return start.toISOString().slice(0, 19);
    }

    // Function to build Google Calendar URL
    function buildGoogleCalendarUrl(entry) {
        // Get the formatted local start and end times
        const localStartFormatted = formatLocalForGoogleCalendar(entry.start);
        const calculatedEndLocal = entry.end ? entry.end : calculateEndTime(entry.start);
        const localEndFormatted = formatLocalForGoogleCalendar(calculatedEndLocal);

        // Get the timezone offset for the start date
        const ozarkOffset = getOzarkTimezoneOffset(entry.start);
        if (!ozarkOffset) { // Handle case where date parsing failed
            console.error("Could not determine timezone offset for event:", entry.title);
            return '#'; // Or handle error gracefully
        }

        const eventLocation = entry.location_google || DEFAULT_GOOGLE_LOCATION;

        let url = "https://calendar.google.com/calendar/render?action=TEMPLATE";
        url += "&text=" + encodeURIComponent(entry.text);
        // Include the timezone offset in the dates parameter
        url += "&dates=" + encodeURIComponent(`${localStartFormatted}${ozarkOffset}/${localEndFormatted}${ozarkOffset}`);
        if (entry.details) url += "&details=" + encodeURIComponent(entry.details);
        url += "&location=" + encodeURIComponent(eventLocation);
        if (entry.recurrence) url += "&recur=" + encodeURIComponent(entry.recurrence);
        return url;
    }

    // Function to render a single event item (remains mostly the same)
    function renderEvent(eventData) {
        const li = document.createElement('li');
        li.className = 'event-item';
        li.id = `event-${eventData.id}`; // Add an ID for potential future use

        li.innerHTML = `
            <div class="event-icon">
                <img src="${eventData['event-image']}" alt="${eventData['event-title']}">
            </div>
            <div class="event-details">
                <h3>${eventData['event-title']}</h3>
                ${eventData['event-dates-display'] ? `<p><strong>Dates:</strong> ${eventData['event-dates-display']}</p>` : ''}
                ${eventData['event-time-display'] ? `<p><strong>Time:</strong> ${eventData['event-time-display']}</p>` : ''}
                <p><strong>Location:</strong> ${eventData['event-location']}</p>
                <p>${eventData['event-plug']}</p>
                <hr>
                <ul class="add-to-calendar-list">
                    ${eventData['calendar-entries'].map(entry => `
                        <li>
                            <a href="${buildGoogleCalendarUrl(entry)}" target="_blank" class="${entry.recurrence ? 'recurring-event' : ''}">
                                <span class="calendar-icon"></span>Add ${entry.text} to Google Calendar
                            </a>
                        </li>
                    `).join('')}
                </ul>
                ${eventData.expando ? `
                    <div class="expando-header" onclick="toggleExpando('${eventData.expando.id}')">
                        <span class="expando-icon"></span> ${eventData.expando.header_text}
                    </div>
                    <div id="${eventData.expando.id}" class="expando-content collapsed">
                        <img src="${eventData.expando.image_src}" alt="${eventData.expando.image_alt}">
                        <p style="text-align: center; font-style: italic; font-size: 0.9em; margin-top: 5px;">${eventData.expando.caption}</p>
                    </div>
                ` : ''}
            </div>
        `;
        return li;
    }

    // Fetch the events data
    fetch("includes/data/event-list.json")
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (loadingMessage) {
                loadingMessage.remove();
            }
            data.forEach(event => {
                const eventElement = renderEvent(event);
                eventList.appendChild(eventElement);
            });
        })
        .catch(error => {
            console.error('Error fetching event data:', error);
            eventList.innerHTML = '<p>Unable to load events at this time. Please check back later.</p>';
        });
});

// The existing toggleExpando function should remain global
function toggleExpando(contentId) {
    /**** This is an example of what would need to be appended after the list of calendar-entries instead of "expando": null
,
      "expando": {
        "id": "vbsImage",
        "header_text": "VBS Kickoff Flyer",
        "image_src": "20250622_VBS_kickoff.jpg",
        "image_alt": "VBS Kickoff flyer",
        "caption": "Come and join us!"
      }
    */
    var contentElement = document.getElementById(contentId);
    var headerElement = contentElement.previousElementSibling;

    contentElement.classList.toggle('collapsed');

    if (headerElement && headerElement.classList.contains('expando-header')) {
        headerElement.classList.toggle('expanded');
    }
}