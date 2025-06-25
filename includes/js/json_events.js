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
        li.id = `event-${eventData.id}`;

        // Determine if the entire event-item should be marked as past-event
        let isOverallPastEvent = false;
        const hasRecurrence = eventData['calendar-entries'].some(entry => entry.recurrence);

        if (!hasRecurrence && eventData['calendar-entries'].length > 0) {
            // Get current time in UTC for comparison
            const now = new Date();
            const currentOffsetMinutes = now.getTimezoneOffset();
            const nowUtcMillis = now.getTime() + (currentOffsetMinutes * 60 * 1000);
            const nowUtcDate = new Date(nowUtcMillis);

            // Check if ALL non-recurring calendar entries are in the past
            // If even one entry is NOT in the past, the overall event is not past.
            isOverallPastEvent = eventData['calendar-entries'].every(entry => {
                const entryStartTime = new Date(entry.start);
                const entryOffsetMinutes = entryStartTime.getTimezoneOffset();
                const entryStartUtcMillis = entryStartTime.getTime() + (entryOffsetMinutes * 60 * 1000);
                const entryStartUtcDate = new Date(entryStartUtcMillis);
                return entryStartUtcDate < nowUtcDate;
            });
        }

        if (isOverallPastEvent) {
            li.classList.add('past-event');
        }

        let expandoHtml = '';
        if (eventData.expando) {
            expandoHtml = `
                <div class="expando-header" onclick="toggleExpando('${eventData.expando.id}')">
                    <span class="expando-icon"></span> ${eventData.expando.header_text}
                </div>
                <div id="${eventData.expando.id}" class="expando-content collapsed">
                    <img src="${eventData.expando.image_src}" alt="${eventData.expando.alt}">
                    <p style="text-align: center; font-style: italic; font-size: 0.9em; margin-top: 5px;">${eventData.expando.caption}</p>
                </div>
            `;
        }

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
                    ${eventData['calendar-entries'].map(entry => {
                        // Check if individual calendar entry is in the past
                        let isEntryPast = false;
                        if (!entry.recurrence) { // Only check non-recurring entries
                            const entryStartTime = new Date(entry.start);
                            const now = new Date();
                            const currentOffsetMinutes = now.getTimezoneOffset();
                            const nowUtcMillis = now.getTime() + (currentOffsetMinutes * 60 * 1000);
                            const nowUtcDate = new Date(nowUtcMillis);

                            const entryOffsetMinutes = entryStartTime.getTimezoneOffset();
                            const entryStartUtcMillis = entryStartTime.getTime() + (entryOffsetMinutes * 60 * 1000);
                            const entryStartUtcDate = new Date(entryStartUtcMillis);

                            if (entryStartUtcDate < nowUtcDate) {
                                isEntryPast = true;
                            }
                        }
                        const entryClass = `${entry.recurrence ? 'recurring-event' : ''} ${isEntryPast ? 'past-calendar-entry' : ''}`;

                        return `
                            <li>
                                <a href="${buildGoogleCalendarUrl(entry)}" target="_blank" class="${entryClass.trim()}">
                                    <span>Add <span class="calendar-icon"></span><span class="event-text">${entry.text}</span> to Google Calendar</span>
                                </a>
                            </li>
                        `;
                    }).join('')}
                </ul>
                ${expandoHtml}
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
            if (loadingMessage) {
                loadingMessage.innerHTML = '<p>Unable to load events at this time. Please check back later.</p>';
            } else {
                eventList.innerHTML = '<p>Unable to load events at this time. Please check back later.</p>';
            }
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