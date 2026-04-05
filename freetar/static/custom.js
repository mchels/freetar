/*****************
 * BEGIN SCROLL STUFF
 *****************/

const SCROLL_STEP_SIZE = 3;
const SCROLL_TIMEOUT_MINIMUM = 50;
const SCROLL_DELAY_AFTER_USER_ACTION = 500;

let pausedForUserInteraction = false;
let scrollTimeout = 500;
let scrollInterval = null;
let pauseScrollTimeout = null;

$('#checkbox_autoscroll').prop("checked", false);


/*****************
* Event Handlers
*****************/

$('#checkbox_autoscroll').click(function () {
    if ($(this).is(':checked')) {
        startScrolling();
    } else {
        stopScrolling();
    }
});

$(window).on("wheel touchmove", function() {
    pauseScrolling(SCROLL_DELAY_AFTER_USER_ACTION);
});

$('#scroll_speed_down').click(function () {
    // Increase the delay to slow down scroll
    scrollTimeout += 50;
    if (scrollInterval !== null)
    {
        pauseScrolling(SCROLL_DELAY_AFTER_USER_ACTION);
        startScrolling();
    }
});

$('#scroll_speed_up').click(function () {
    // Decrease the delay to speed up scroll.
    // Don't decrease the delay all the way to 0
    scrollTimeout = Math.max(50, scrollTimeout - 50);

    if (scrollInterval !== null)
    {
        pauseScrolling(SCROLL_DELAY_AFTER_USER_ACTION);
        startScrolling();
    }
});


/*******************
 * Scroll Functions
 ******************/

// Scroll the page by SCROLL_STEP_SIZE
// Will not do anything if `pausedForUserInteraction` is set to `true`
function pageScroll() {
    if (pausedForUserInteraction) { return; }

    window.scrollBy(0, SCROLL_STEP_SIZE);
}

// Sets up the `pageScroll` function to be called in a loop every
// `scrollTimeout` milliseconds
function startScrolling() {
    if (scrollInterval) {
        clearInterval(scrollInterval);
    }
    scrollInterval = setInterval(pageScroll, scrollTimeout);
}

// Sets `pausedForUserInteraction` to `true` for `delay` milliseconds. 
// Will stop `pageScroll` from actually scrolling the page
function pauseScrolling(delay) {
    pausedForUserInteraction = true;
    clearTimeout(pauseScrollTimeout);
    pauseScrollTimeout = setTimeout(() => pausedForUserInteraction = false, delay);
}

// Clears the interval that got set up in `startScrolling`
function stopScrolling() {
    clearInterval(scrollInterval);
}


/*****************
 * DONE SCROLL STUFF
 *****************/

function colorize_favs() {
    // make every entry yellow if we faved it before
    favorites = JSON.parse(localStorage.getItem("favorites")) || {};

    $("#results tr").each(function () {
        var tab_url = $(this).find(".song").find("a").attr("href");
        if (favorites[tab_url] != undefined) {
            $(this).find(".favorite").css("color", "#ffae00");
        }
    });
}

function initialise_transpose() {
    let transpose_value = 0;
    const transposedSteps = $('#transposed_steps')
    const minus = $('#transpose_down')
    const plus = $('#transpose_up')
    plus.click(function () {
        transpose_value = Math.min(11, transpose_value + 1)
        transpose()
    });
    minus.click(function () {
        transpose_value = Math.max(-11, transpose_value - 1)
        transpose()
    });
    transposedSteps.click(function () {
        transpose_value = 0
        transpose()
    });

    $('.tab').find('.chord-root, .chord-bass').each(function () {
        const text = $(this).text()
        $(this).attr('data-original', text)
    })

    function transpose() {
        $('.tab').find('.chord-root, .chord-bass').each(function () {
            const originalText = $(this).attr('data-original')
            const transposedSteps = $('#transposed_steps')
            if (transpose_value === 0) {
                $(this).text(originalText)
                transposedSteps.hide()
            } else {
                const new_text = transpose_note(originalText.trim(), transpose_value)
                $(this).text(new_text)
                transposedSteps.text((transpose_value > 0 ? "+" : "") + transpose_value)
                transposedSteps.show()
            }
        });
    }
}

// Defines a list of notes, grouped with any alternate names (like D# and Eb)
const noteNames = [
    ['A'],
    ['A#', 'Bb'],
    ['B','Cb'],
    ['C', 'B#'],
    ['C#', 'Db'],
    ['D'],
    ['D#', 'Eb'],
    ['E', 'Fb'],
    ['F', 'E#'],
    ['F#', 'Gb'],
    ['G'],
    ['G#', 'Ab'],
];

// Find the given note in noteNames, then step through the list to find the
// next note up or down. Currently just selects the first note name that
// matches. It doesn't preserve sharp, flat, or any try to determine what
// key we're in.
function transpose_note(note, transpose_value) {
    let noteIndex = noteNames.findIndex(tone => tone.includes(note));
    if (noteIndex === -1)
    {
        console.debug("Note ["+note+"] not found. Can't transpose");
        return note;
    }

    let new_index = (noteIndex + transpose_value) % 12;
    if (new_index < 0) {
        new_index += 12;
    }

    // TODO: Decide on sharp, flat, or natural
    return noteNames[new_index][0];
}

function initialise_columns() {
    let column_count = parseInt(localStorage.getItem("column_count")) || 4;
    let column_width = 0; // 0 means "auto"
    let original_content = null;
    const columnsCount = $('#columns_count');
    const columnsDown = $('#columns_down');
    const columnsUp = $('#columns_up');
    const widthValue = $('#width_value');
    const widthDown = $('#width_down');
    const widthUp = $('#width_up');
    const tabDiv = $('.tab');

    // Store original content
    if (tabDiv.length > 0) {
        original_content = tabDiv.html();
    }

    columnsUp.click(function () {
        column_count = Math.min(10, column_count + 1);
        localStorage.setItem("column_count", column_count);
        applyColumns();
    });

    columnsDown.click(function () {
        column_count = Math.max(1, column_count - 1);
        localStorage.setItem("column_count", column_count);
        applyColumns();
    });

    widthUp.click(function () {
        if (column_width === 0) {
            column_width = 20;
        } else {
            column_width += 10;
        }
        applyColumns();
    });

    widthDown.click(function () {
        if (column_width > 20) {
            column_width -= 10;
        } else {
            column_width = 0;
        }
        applyColumns();
    });

    function textLength(htmlLine) {
        let text = htmlLine.replace(/<[^>]*>/g, '');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        return text.length;
    }

    function isChordOrTabLine(htmlLine) {
        if (htmlLine.indexOf('class="chord') !== -1) return true;
        let text = htmlLine.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return /^[A-Ga-ge]\|/.test(text) || text.indexOf('|--') !== -1;
    }

    function wordWrap(text, maxWidth) {
        if (maxWidth <= 0) return text;
        const words = text.split('&nbsp;');
        if (words.length <= 1) return text;
        const wrapped = [];
        let line = words[0];
        let lineLen = textLength(words[0]);
        for (let i = 1; i < words.length; i++) {
            const wordLen = textLength(words[i]);
            if (lineLen + 1 + wordLen <= maxWidth) {
                line += '&nbsp;' + words[i];
                lineLen += 1 + wordLen;
            } else {
                wrapped.push(line);
                line = words[i];
                lineLen = wordLen;
            }
        }
        if (line) wrapped.push(line);
        return wrapped.join('\n');
    }

    function applyColumns() {
        columnsCount.text(column_count);
        widthValue.text(column_width > 0 ? column_width + 'ch' : 'auto');

        if (!original_content || tabDiv.length === 0) {
            return;
        }

        // Capture transpose state before modifying DOM
        const currentTransposeValue = $('#transposed_steps').is(':visible') ?
            parseInt($('#transposed_steps').text()) || 0 : 0;

        // Store current data-original attributes for all chord elements
        const chordData = [];
        $('.tab').find('.chord-root, .chord-bass').each(function() {
            const originalText = $(this).attr('data-original');
            if (originalText) {
                chordData.push({
                    text: $(this).text(),
                    original: originalText,
                    classes: $(this).attr('class')
                });
            }
        });

        if (column_count === 1) {
            // Single column - restore original content
            tabDiv.html(original_content);
            tabDiv.css({
                'display': '',
                'grid-template-columns': '',
                'gap': ''
            });
        } else {
            // Multiple columns - split content
            // First, convert <br> tags to newlines for easier splitting
            let htmlContent = original_content.replace(/<br\s*\/?>/gi, '\n');

            let processedHtml = htmlContent;

            // Split by newlines while preserving HTML tags
            const lines = processedHtml.split('\n');

            // Group chord+lyrics pairs into atomic units that cannot be split across columns
            const units = [];
            for (let i = 0; i < lines.length; ) {
                if (lines[i].indexOf('<span class="chord') !== -1 && i + 1 < lines.length) {
                    units.push([lines[i], lines[i + 1]]);
                    i += 2;
                } else {
                    units.push([lines[i]]);
                    i += 1;
                }
            }

            // Distribute units into columns, never splitting a chord-lyrics pair
            const totalLines = units.reduce(function(sum, u) { return sum + u.length; }, 0);
            const targetPerCol = Math.ceil(totalLines / column_count);
            const columns = [];
            var currentCol = [];
            var currentCount = 0;

            for (var u = 0; u < units.length; u++) {
                var unit = units[u];
                if (currentCount > 0 && currentCount + unit.length > targetPerCol && columns.length < column_count - 1) {
                    columns.push(currentCol);
                    currentCol = [];
                    currentCount = 0;
                }
                for (var k = 0; k < unit.length; k++) { currentCol.push(unit[k]); }
                currentCount += unit.length;
            }
            if (currentCol.length > 0) { columns.push(currentCol); }

            // Calculate column widths from chord/tab lines only
            const columnWidths = [];
            for (var col = 0; col < columns.length; col++) {
                let maxLen = 0;
                for (const line of columns[col]) {
                    if (isChordOrTabLine(line)) {
                        const len = textLength(line);
                        if (len > maxLen) maxLen = len;
                    }
                }
                const padded = maxLen + 4;
                columnWidths.push(column_width > 0 ? Math.min(padded, column_width) : padded);
            }

            const gridCols = columnWidths.map(function(w) { return w + 'ch'; }).join(' ');
            let columnHtml = '<div style="display: grid; grid-template-columns: ' + gridCols + '; gap: 2rem; overflow-x: auto;">';

            for (var c = 0; c < columns.length; c++) {
                // Hard-wrap prose lines to fit the column width
                const wrapWidth = columnWidths[c];
                const wrappedLines = [];
                for (const line of columns[c]) {
                    if (!isChordOrTabLine(line) && textLength(line) > wrapWidth) {
                        wrappedLines.push(wordWrap(line, wrapWidth));
                    } else {
                        wrappedLines.push(line);
                    }
                }

                const widthStyle = column_width > 0 ? ' max-width: ' + column_width + 'ch; overflow: hidden;' : '';
                columnHtml += '<div class="font-monospace" style="white-space: pre-wrap; min-width: 0;' + widthStyle + '">';
                columnHtml += wrappedLines.join('\n').replace(/^\n+/, '');
                columnHtml += '</div>';
            }

            columnHtml += '</div>';
            tabDiv.html(columnHtml);
        }

        // Restore transpose functionality after DOM modification
        let chordIndex = 0;
        $('.tab').find('.chord-root, .chord-bass').each(function() {
            if (chordIndex < chordData.length) {
                const chord = chordData[chordIndex];
                $(this).attr('data-original', chord.original);

                // Apply current transpose if needed
                if (currentTransposeValue !== 0) {
                    const transposedText = transpose_note(chord.original.trim(), currentTransposeValue);
                    $(this).text(transposedText);
                } else {
                    $(this).text(chord.original);
                }
                chordIndex++;
            }
        });

        // Ensure transpose display is correct
        if (currentTransposeValue !== 0) {
            $('#transposed_steps').text((currentTransposeValue > 0 ? "+" : "") + currentTransposeValue);
            $('#transposed_steps').show();
        } else {
            $('#transposed_steps').hide();
        }
    }

    // Initialize with single column
    applyColumns();
}

$(document).ready(function () {
    colorize_favs();
    initialise_transpose();
    initialise_columns();
});


$('#checkbox_view_chords').click(function(){
    if($(this).is(':checked')){
        $("#chordVisuals").show();
    } else {
        $("#chordVisuals").hide();
    }
});

$('#dark_mode').click(function(){
    if (document.documentElement.getAttribute('data-bs-theme') == 'dark') {
        document.documentElement.setAttribute('data-bs-theme', 'light');
        localStorage.setItem("dark_mode", false);
    }
    else {
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        localStorage.setItem("dark_mode", true);
    }
});

document.querySelectorAll('.favorite').forEach(item => {
  item.addEventListener('click', event => {
    favorites = JSON.parse(localStorage.getItem("favorites")) || {};
    elm = event.target;
    tab_url = elm.getAttribute('data-url')
    if (tab_url in favorites) {
        delete favorites[tab_url];
        $(elm).css("color", "");
    } else {
      const fav = {
        artist_name: elm.getAttribute('data-artist'),
        song: elm.getAttribute('data-song'),
        type: elm.getAttribute('data-type'),
        rating: elm.getAttribute('data-rating'),
        tab_url: elm.getAttribute('data-url')
      }
      favorites[fav["tab_url"]] = fav;
      $(elm).css("color", "#ffae00");
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
  })
})

