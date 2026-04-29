const http = require('http');

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(buf) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: buf });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const errors = [];

  // 1. Login
  const login = await request('POST', '/api/auth/login', {
    email: 'kenji@nakatadojo.com',
    password: 'Director123!'
  });
  const cookie = login.headers['set-cookie']?.[0]?.split(';')[0];
  console.log('Login status:', login.status, cookie ? 'cookie obtained' : 'NO COOKIE');
  if (login.status !== 200 || !cookie) {
    errors.push('Login failed: ' + JSON.stringify(login.body));
    console.log(JSON.stringify({ errors }, null, 2));
    return;
  }

  // 2. Create tournament
  const tournamentData = {
    name: "CAMPEONATO TRADICIONAL DE KARATE-DO SKIF SONORA 2026",
    description: "LA SHOTOKAN KARATE-DO INTERNACIONAL FEDERACION MEXICO Y LA SHOTOKAN KARATE-DO INTERNACIONAL FEDERACION SONORA, EN COORDINACION CON LA LIGA MUNICIPAL DE KARATE-DO DE HERMOSILLO\n\nCONVOCAN a través de las Asociaciones Estatales y clubs, a deportistas, entrenadores, árbitros y representantes de estado a participar en el CAMPEONATO TRADICIONAL DE KARATE-DO SKIF SONORA 2026.\n\nFecha: Domingo 26 de abril de 2026\nLugar: Gimnasio del Instituto Tecnológico de Hermosillo, Avenida Tecnológico S/N, Colonia el Sahuaro, Hermosillo, Sonora, México.\n\nPROGRAMA:\n• Pesaje oficial cintas negras adultos: 8:00 a 9:00 AM\n• Inicio de competencia (todas las categorías): 9:00 AM\n\nREGLAMENTO: Sistema KO HAKU, eliminación sencilla con dos terceros lugares.\n\nUNIFORMES: Karate-gi blanco y limpio. Equipo de protección: guantes blancos, protector bucal, protector interior de pecho (mujeres), concha protectora (hombres).\n\nENTRENADORES: Solo se permite un coach por cada una de las categorías.\n\nInscripciones: La inscripción se realizará de forma automática en la plataforma electrónica. Cierre de inscripciones: Sábado 18 de abril de 2026.",
    startDate: "2026-04-26",
    endDate: "2026-04-26",
    location: "Gimnasio del Instituto Tecnológico de Hermosillo",
    address: "Avenida Tecnológico Sin número, Colonia el Sahuaro, Hermosillo, Sonora, México",
    timezone: "America/Hermosillo",
    currency: "MXN",
    registrationDeadline: "2026-04-18"
  };

  const tournamentRes = await request('POST', '/api/tournaments', tournamentData, cookie);
  console.log('Create tournament status:', tournamentRes.status);
  console.log('Tournament response:', JSON.stringify(tournamentRes.body, null, 2));

  if (tournamentRes.status !== 201 && tournamentRes.status !== 200) {
    errors.push('Tournament creation failed: ' + JSON.stringify(tournamentRes.body));
    console.log(JSON.stringify({ errors }, null, 2));
    return;
  }

  const tournament = tournamentRes.body.tournament || tournamentRes.body;
  const tournamentId = tournament.id;
  const tournamentSlug = tournament.slug;
  console.log('Tournament ID:', tournamentId, 'Slug:', tournamentSlug);

  // 3. Create event types
  const eventTypes = [
    {
      name: "Kata Individual",
      description: "Ficha única KATA Y KUMITE incluida. Sistema KO HAKU: eliminación sencilla basada en banderas. Cintas Blanca a Morada: katas básicas obligatorias (Heian). Cintas Café y Negra: kata libre.",
      priceOverride: 900,
      isEventType: true
    },
    {
      name: "Kumite Individual",
      description: "Incluido en ficha única con Kata. Sistema SHOBU IPPON HAN (2 minutos tiempo efectivo). Cintas Negras Adulto Varonil: dos divisiones de peso (-70kg y +70kg). Cintas Negras Adulto Femenil: dos divisiones de peso (-60kg y +60kg). Final cintas negras adulto: sistema SHOBU SANBON (5 minutos).",
      priceOverride: 0,
      isEventType: true
    },
    {
      name: "Kata por Equipos",
      description: "3 participantes por equipo del mismo sexo. Categorías: Infantil (hasta 13 años), Juvenil (14-17 años), Adulto (18 en adelante), Varonil y Femenil. Equipos pueden integrarse por cintas cafés o negras. Se puede registrar más de un equipo por academia.",
      priceOverride: 700,
      teamSize: 3,
      isEventType: true
    },
    {
      name: "Kumite por Equipos",
      description: "Varonil Adulto: 5 participantes. Femenil Adulto: 3 participantes. Juvenil Varonil: 3 participantes. Juvenil Femenil: 3 participantes. Infantil Varonil: 3 participantes. Infantil Femenil: 3 participantes. Equipos de cintas cafés o negras. Se puede registrar más de un equipo por academia.",
      priceOverride: 700,
      teamSize: 3,
      isEventType: true
    }
  ];

  const eventTypeIds = {};
  const eventTypeKeys = ['kataIndividual', 'kumiteIndividual', 'kataEquipos', 'kumiteEquipos'];

  for (let i = 0; i < eventTypes.length; i++) {
    const et = eventTypes[i];
    const res = await request('POST', `/api/tournaments/${tournamentId}/events`, et, cookie);
    console.log(`Event type "${et.name}" status:`, res.status);
    console.log('Response:', JSON.stringify(res.body, null, 2));

    if (res.status !== 201 && res.status !== 200) {
      errors.push(`Event type "${et.name}" creation failed: ` + JSON.stringify(res.body));
    } else {
      const created = res.body.event || res.body;
      eventTypeIds[eventTypeKeys[i]] = created.id;
      console.log(`  -> ID: ${created.id}`);
    }
  }

  // Final summary
  const summary = {
    tournamentId,
    tournamentSlug,
    eventTypeIds,
    errors: errors.length > 0 ? errors : undefined
  };

  console.log('\n=== FINAL SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);
