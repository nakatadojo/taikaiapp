// Sample Data Generator for Karate Tournament Manager

function loadSampleData() {
    // Clear existing data
    localStorage.clear();

    // Sample clubs
    const clubs = [
        { id: 1, name: 'Dragon Dojo', city: 'Los Angeles', country: 'USA', email: 'info@dragondojo.com' },
        { id: 2, name: 'Rising Sun Karate', city: 'Tokyo', country: 'Japan', email: 'contact@risingsun.jp' },
        { id: 3, name: 'Eagle Dojo', city: 'London', country: 'UK', email: 'info@eagledojo.uk' },
        { id: 4, name: 'Tiger Elite', city: 'Sydney', country: 'Australia', email: 'info@tigerelite.au' },
        { id: 5, name: 'Phoenix Warriors', city: 'Toronto', country: 'Canada', email: 'info@phoenixwarriors.ca' },
        { id: 6, name: 'Samurai School', city: 'Osaka', country: 'Japan', email: 'contact@samuraischool.jp' },
        { id: 7, name: 'Black Belt Dojo', city: 'New York', country: 'USA', email: 'info@blackbeltdojo.com' },
        { id: 8, name: 'Spirit Karate', city: 'Berlin', country: 'Germany', email: 'info@spiritkarate.de' }
    ];

    // Sample instructors
    const instructors = [
        { id: 1, firstName: 'Sensei', lastName: 'Yamamoto', rank: '7th Dan', club: 'Rising Sun Karate', email: 'yamamoto@risingsun.jp', phone: '+81-3-1234-5678' },
        { id: 2, firstName: 'Master', lastName: 'Chen', rank: '6th Dan', club: 'Dragon Dojo', email: 'chen@dragondojo.com', phone: '+1-310-555-0101' },
        { id: 3, firstName: 'Sensei', lastName: 'Smith', rank: '5th Dan', club: 'Eagle Dojo', email: 'smith@eagledojo.uk', phone: '+44-20-7946-0958' },
        { id: 4, firstName: 'Master', lastName: 'Johnson', rank: '6th Dan', club: 'Black Belt Dojo', email: 'johnson@blackbeltdojo.com', phone: '+1-212-555-0102' }
    ];

    // First and last names for generation
    const firstNames = ['Alex', 'Ben', 'Chris', 'David', 'Emma', 'Sophia', 'Olivia', 'Ava', 'Isabella', 'Mia',
        'Noah', 'Liam', 'Lucas', 'Mason', 'Ethan', 'James', 'William', 'Henry', 'Jack', 'Leo',
        'Yuki', 'Hana', 'Kenji', 'Sora', 'Akira', 'Haruto', 'Riku', 'Sakura', 'Aoi', 'Mei',
        'Andre', 'Bruno', 'Carlos', 'Diego', 'Elena', 'Gabriela', 'Hugo', 'Isabel', 'Juan', 'Luis',
        'Mohammed', 'Fatima', 'Omar', 'Aisha', 'Hassan', 'Layla', 'Ali', 'Amira', 'Khalid', 'Zara'];

    const lastNames = ['Anderson', 'Brown', 'Davis', 'Garcia', 'Johnson', 'Jones', 'Martinez', 'Miller', 'Moore', 'Rodriguez',
        'Tanaka', 'Suzuki', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Sato', 'Ito', 'Kato', 'Yoshida',
        'Smith', 'Wilson', 'Taylor', 'Thomas', 'White', 'Harris', 'Martin', 'Thompson', 'Clark', 'Lewis',
        'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim',
        'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Ferreira', 'Rodrigues', 'Almeida', 'Nascimento'];

    const ranks = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', '1st Dan', '2nd Dan', '3rd Dan'];
    const genders = ['Male', 'Female'];

    // Generate 100 competitors
    const competitors = [];
    for (let i = 1; i <= 100; i++) {
        const age = Math.floor(Math.random() * 40) + 8; // Ages 8-47
        const gender = genders[Math.floor(Math.random() * genders.length)];
        const club = clubs[Math.floor(Math.random() * clubs.length)];
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

        // Rank based on age/experience
        let rank;
        if (age < 12) {
            rank = ranks[Math.floor(Math.random() * 5)]; // Beginner ranks
        } else if (age < 18) {
            rank = ranks[Math.floor(Math.random() * 7) + 2]; // Intermediate ranks
        } else {
            rank = ranks[Math.floor(Math.random() * 10)]; // All ranks
        }

        const experience = Math.min(age - 6, Math.floor(Math.random() * 15) + 1);

        competitors.push({
            id: Date.now() + i,
            firstName,
            lastName,
            age,
            weight: Math.floor(Math.random() * 60) + 40 + (age - 8) * 2, // Weight increases with age
            rank,
            experience,
            gender,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
            phone: `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            club: club.name,
            country: club.country,
            photo: null,
            registrationDate: new Date().toISOString()
        });
    }

    // Create division template
    const template = {
        id: Date.now(),
        name: 'Standard Tournament Divisions',
        criteria: [
            {
                type: 'age',
                ranges: [
                    { min: 8, max: 10, label: '8-10 Years' },
                    { min: 11, max: 13, label: '11-13 Years' },
                    { min: 14, max: 17, label: '14-17 Years' },
                    { min: 18, max: 35, label: 'Adults' },
                    { min: 36, max: 100, label: 'Masters 36+' }
                ]
            },
            {
                type: 'gender',
                ranges: [
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' }
                ]
            },
            {
                type: 'rank',
                ranges: [
                    { value: 'White', label: 'Beginner (White)' },
                    { value: 'Yellow', label: 'Beginner (Yellow)' },
                    { value: 'Orange', label: 'Beginner (Orange)' },
                    { value: 'Green', label: 'Intermediate (Green)' },
                    { value: 'Blue', label: 'Intermediate (Blue)' },
                    { value: 'Purple', label: 'Intermediate (Purple)' },
                    { value: 'Brown', label: 'Advanced (Brown)' },
                    { value: '1st Dan', label: 'Black Belt (1st Dan)' },
                    { value: '2nd Dan', label: 'Black Belt (2nd Dan)' },
                    { value: '3rd Dan', label: 'Black Belt (3rd+ Dan)' }
                ]
            }
        ]
    };

    // Mats configuration
    const mats = [
        { id: 1, name: 'Mat 1', active: true },
        { id: 2, name: 'Mat 2', active: true },
        { id: 3, name: 'Mat 3', active: true },
        { id: 4, name: 'Mat 4', active: true }
    ];

    // Sample matches
    const matches = [];
    const divisions = ['Kata - Forms', 'Kumite - Sparring'];
    for (let i = 0; i < 20; i++) {
        const matId = (i % 4) + 1;
        const red = competitors[Math.floor(Math.random() * competitors.length)];
        const blue = competitors[Math.floor(Math.random() * competitors.length)];

        if (red.id !== blue.id) {
            const hour = 9 + Math.floor(i / 4);
            const minute = (i % 4) * 15;

            matches.push({
                id: Date.now() + i + 1000,
                matId,
                division: divisions[i % 2],
                redId: red.id,
                blueId: blue.id,
                time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                type: divisions[i % 2] === 'Kata - Forms' ? 'kata' : 'kumite',
                status: 'scheduled',
                createdAt: new Date().toISOString()
            });
        }
    }

    // Save all data
    localStorage.setItem('clubs', JSON.stringify(clubs));
    localStorage.setItem('instructors', JSON.stringify(instructors));
    localStorage.setItem('competitors', JSON.stringify(competitors));
    localStorage.setItem('templates', JSON.stringify([template]));
    localStorage.setItem('mats', JSON.stringify(mats));
    localStorage.setItem('matches', JSON.stringify(matches));
    localStorage.setItem('divisions', JSON.stringify({}));
    localStorage.setItem('matScoreboards', JSON.stringify({}));

    alert('✅ Sample data loaded successfully!\\n\\n• 100 Competitors\\n• 8 Dojos\\n• 4 Instructors\\n• 1 Division Template\\n• 4 Mats\\n• 20 Scheduled Matches\\n\\nRefresh the page to see the data!');
}

// Auto-load on page load if no data exists
window.addEventListener('load', () => {
    const competitors = localStorage.getItem('competitors');
    if (!competitors || JSON.parse(competitors).length === 0) {
        if (confirm('No data found. Would you like to load sample tournament data?\\n\\n(100 competitors, 8 dojos, division template, and scheduled matches)')) {
            loadSampleData();
            window.location.reload();
        }
    }
});
