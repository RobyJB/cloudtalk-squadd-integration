require('dotenv').config();

async function testGHLUsersAPI() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = 'i30YnwSzJ1ld5lsxtnb2';

  console.log('🧪 Test API GoHighLevel Users');
  console.log('API Key presente:', !!apiKey);
  console.log('Location ID:', locationId);

  try {
    const response = await fetch(`https://services.leadconnectorhq.com/users/?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28'
      }
    });

    console.log('Status:', response.status);
    console.log('Rate limit remaining:', response.headers.get('x-ratelimit-remaining'));

    if (!response.ok) {
      console.error('❌ Errore API:', await response.text());
      return;
    }

    const data = await response.json();
    console.log('✅ Successo!');
    console.log('- Totale utenti:', data.users?.length);
    console.log('- TraceId:', data.traceId);

    // ANALISI DETTAGLIATA
    if (data.users && data.users.length > 0) {
      console.log('\n📊 ANALISI STRUTTURA:');
      console.log('- Campi primo utente:', Object.keys(data.users[0]));
      
      // JSON COMPLETO PRIMO UTENTE
      console.log('\n📄 JSON COMPLETO PRIMO UTENTE:');
      console.log(JSON.stringify(data.users[0], null, 2));

      // JSON COMPLETO SECONDO UTENTE (se esiste)
      if (data.users[1]) {
        console.log('\n📄 JSON COMPLETO SECONDO UTENTE:');
        console.log(JSON.stringify(data.users[1], null, 2));
      }

      // ANALISI RUOLI
      console.log('\n👥 ANALISI RUOLI:');
      const roleStats = {};
      data.users.forEach(user => {
        const roleKey = `${user.roles?.type}_${user.roles?.role}`;
        roleStats[roleKey] = (roleStats[roleKey] || 0) + 1;
      });
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`- ${role}: ${count} utenti`);
      });

      // ANALISI SCOPE
      const firstUser = data.users[0];
      if (firstUser.scopes) {
        console.log('\n🔐 SCOPES PRIMO UTENTE:');
        console.log('- Numero scopes:', firstUser.scopes.length);
        console.log('- Prime 5 scopes:', firstUser.scopes.slice(0, 5));
        console.log('- Scopes completi:', JSON.stringify(firstUser.scopes, null, 2));
      }

      // ANALISI LOCATION IDS
      if (firstUser.roles?.locationIds) {
        console.log('\n📍 LOCATION ACCESS:');
        console.log('- Location IDs accessibili:', firstUser.roles.locationIds);
        console.log('- Numero locations:', firstUser.roles.locationIds.length);
      }

      // ANALISI TELEFONI
      if (firstUser.phone) {
        console.log('\n📱 CONTATTI PRIMO UTENTE:');
        console.log('- Phone:', firstUser.phone);
        console.log('- Extension:', firstUser.extension);
        if (firstUser.lcPhone) {
          console.log('- LC Phone:', JSON.stringify(firstUser.lcPhone, null, 2));
        }
      }

      // ANALISI MEMBERSHIP
      if (firstUser.membershipContactId) {
        console.log('\n🎫 MEMBERSHIP INFO:');
        console.log('- Membership Contact ID:', firstUser.membershipContactId);
        console.log('- Freshdesk Contact ID:', firstUser.freshdeskContactId);
      }

      // ANALISI PROFILE PHOTO
      const usersWithPhoto = data.users.filter(user => user.profilePhoto);
      console.log('\n📸 PROFILE PHOTOS:');
      console.log('- Utenti con foto:', usersWithPhoto.length);
      if (usersWithPhoto.length > 0) {
        console.log('- Prima foto URL:', usersWithPhoto[0].profilePhoto);
      }

      // ANALISI STATO DELETED
      const deletedUsers = data.users.filter(user => user.deleted);
      console.log('\n🗑️ UTENTI ELIMINATI:');
      console.log('- Utenti deleted:', deletedUsers.length);

      // STATISTICHE GENERALI
      console.log('\n📈 STATISTICHE GENERALI:');
      console.log('- Utenti con telefono:', data.users.filter(u => u.phone).length);
      console.log('- Utenti con extension:', data.users.filter(u => u.extension).length);
      console.log('- Utenti agency type:', data.users.filter(u => u.roles?.type === 'agency').length);
      console.log('- Utenti account type:', data.users.filter(u => u.roles?.type === 'account').length);
      console.log('- Utenti admin role:', data.users.filter(u => u.roles?.role === 'admin').length);
      console.log('- Utenti user role:', data.users.filter(u => u.roles?.role === 'user').length);
    }

    console.log('\n🎯 TEST COMPLETATO - Dati pronti per mapping!');
    return data;

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

testGHLUsersAPI();