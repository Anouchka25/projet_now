// Exemple côté backend (Node/Express)
const onfido = require('@onfido/api');

const onfidoClient = new onfido.Onfido({
  apiToken: 'api_live.Q-g48F02cfe.qZkf7FqbK276efLL3WXQr82tKMAAD1qH'
});

app.post('/create-onfido-token', async (req, res) => {
  const applicant = await onfidoClient.applicant.create({
    firstName: req.body.firstName,
    lastName: req.body.lastName
  });

  const sdkToken = await onfidoClient.sdkToken.generate({
    applicantId: applicant.id,
    referrer: "https://kundapay.com/*"
  });

  res.json({ sdkToken });
});
