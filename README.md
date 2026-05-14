# FIFA World Cup 2026 Schedule IST

A sleek, modern web application to view FIFA World Cup 2026 match schedules with times converted to **Indian Standard Time (IST)**.

## Features

✨ **Key Features:**
- 📅 **Today's Matches** - Dedicated section showing matches scheduled for today
- 🔍 **Search Functionality** - Search matches by team name in real-time
- 🌍 **IST Time Conversion** - All match times automatically converted from UTC to IST (Asia/Kolkata)
- 📱 **Responsive Design** - Works seamlessly on mobile, tablet, and desktop
- 🎨 **Modern UI** - Dark theme with Tailwind CSS for a professional look
- ⚡ **Fast & Lightweight** - Built with vanilla JavaScript, no dependencies

## Tech Stack

- **HTML5** - Structure
- **CSS3** - Styling (with Tailwind CSS)
- **JavaScript** - Dynamic functionality and time conversion
- **JSON** - Data storage for match schedules

## Project Structure

```
fifa26/
├── index.html      # Main HTML page
├── styles.css      # Custom CSS styling
├── script.js       # JavaScript logic for rendering and search
├── matches.json    # World Cup 2026 schedule data
└── README.md       # Project documentation
```

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No server or additional dependencies required

### Installation

1. Clone the repository:
```bash
git clone https://github.com/srinfinityvlogs/fifa26.git
cd fifa26
```

2. Open `index.html` in your browser:
```bash
# On macOS
open index.html

# On Windows
start index.html

# Or simply drag and drop into your browser
```

## Usage

1. **View All Matches** - Scroll down to see the complete FIFA World Cup 2026 schedule
2. **View Today's Matches** - Check the "Today's Matches" section at the top
3. **Search Teams** - Use the search bar to filter matches by team name
4. **Time Display** - All times are automatically shown in IST format

## Match Data Format

Each match in `matches.json` follows this structure:

```json
{
  "date": "2026-06-11",
  "timeUTC": "2026-06-11T18:00:00Z",
  "team1": "Mexico",
  "team2": "Japan",
  "stadium": "Estadio Azteca",
  "group": "A"
}
```

- **date**: Match date in YYYY-MM-DD format
- **timeUTC**: Match time in UTC ISO 8601 format
- **team1**: First team name
- **team2**: Second team name
- **stadium**: Stadium name
- **group**: Group letter (A-H)

## Adding More Matches

To add more matches to the schedule:

1. Open `matches.json`
2. Add new match objects to the array following the format above
3. Save the file
4. Refresh the browser to see the updates

Example:
```json
{
  "date": "2026-06-15",
  "timeUTC": "2026-06-15T22:00:00Z",
  "team1": "Spain",
  "team2": "Italy",
  "stadium": "AT&T Stadium",
  "group": "D"
}
```

## Features in Detail

### Time Zone Conversion
- Automatically converts UTC times to IST
- Displays in user-friendly format: "Wed, 11 Jun, 6:30 PM"
- Uses browser's `toLocaleString()` API

### Search Functionality
- Real-time filtering as you type
- Case-insensitive search
- Searches both team names

### Responsive Design
- Mobile-first approach
- Flexbox layout for proper alignment
- Touch-friendly interface

## Customization

### Modify Colors
Edit the Tailwind CSS classes in `index.html` to change the color scheme:
- `bg-zinc-950` - Background color
- `text-blue-400` - Accent color

### Add More Styling
Extend `styles.css` with custom styles or update Tailwind configuration.

## Browser Support

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

## Performance

- Lightweight: ~5KB total size (excluding Tailwind CDN)
- No build process required
- Instant load times
- Smooth animations with CSS transitions

## Future Enhancements

Potential features to add:
- [ ] Match results and live scores
- [ ] Team statistics
- [ ] Favorite matches (localStorage)
- [ ] Dark/Light theme toggle
- [ ] Multiple language support
- [ ] Share matches on social media
- [ ] Desktop notifications for matches

## Contributing

Feel free to fork this repository and submit pull requests for any improvements!

## License

This project is open source and available under the MIT License.

## Author

Built with ⚽ by [srinfinityvlogs](https://github.com/srinfinityvlogs)

## Support

If you encounter any issues or have suggestions, please open an issue on GitHub.

---

**Enjoy the FIFA World Cup 2026! ⚽🌟**