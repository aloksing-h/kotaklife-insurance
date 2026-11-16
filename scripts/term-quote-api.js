import invokeGateway from './gateway-api.js';

const TERM_QUOTE_GATEWAY_KEY = 'kli-nps-lw-pricing'; // Replace with the configured backend gateway key.

/**
 * Builds the full term quote request payload, substituting only the
 * insured age, gender, tobacco usage, and sum assured from the inputs.
 * @param {{ age: number, gender: string, tobaccoUser: boolean, lifeCover: number }} inputs
 * @returns {object} The complete request payload
 */
function buildTermQuotePayload({
  age, gender, tobaccoUser, lifeCover,
}) {
  return {
    Request: {
      RequestInfo: {
        UserName: '',
        CreationDate: '2026-7-20',
        CreationTime: '17:29:37-664',
        Source: 'B2C_eTerm_Web',
        SourceInfoName: 'B2C_eTerm_Web',
        TransactionId: 'a9ce1091-c778-41ce-8804-6e444f39d911',
        RequestorToken: '',
        LastSyncDate: '',
      },
      RequestPayload: {
        Transactions: [
          {
            TransactionData: {
              InsuredInfo: {
                AdvisorState: 'Maharashtra',
                CustomerState: 'Maharashtra',
                InsuredAge: String(age),
                InsuredGender: String(gender),
                IsInsuredAndPremiumPayer: 'true',
                IsDeferred: '',
                IsJointLife: '',
                ProposerAge: '18',
                ProposerGender: '',
                SpouseAge: '',
                SpouseGender: '',
                ClientCategory: 'New Customers',
                SalesChannel: 'Online Distribution',
                SalariedCustomer: 'Yes',
                IsExistingCustomer: 'false',
                IsTobacoUser: String(tobaccoUser),
              },
              BasecoverandPlanInfo: [
                {
                  DistributionChannel: 'ONLINE',
                  PlanOption: 'Immediate Payout',
                  PlanOptionType: 'Life',
                  StepUpOption: 'No',
                  SumAssured: String(lifeCover),
                  PolicyTerm: '57',
                  PremiumPaymentTerm: '42',
                  PremiumPaymentFrequency: 'YEARLY',
                  Riderdetials: [],
                },
              ],
              PlanCode: 'K92',
              Source: 'B2C_eTerm_Web',
            },
          },
        ],
      },
    },
  };
}

export default async function getTermQuote(inputs) {
  const payload = buildTermQuotePayload(inputs);
  const envelope = await invokeGateway(TERM_QUOTE_GATEWAY_KEY, payload);
  const quote = envelope.data;
  // eslint-disable-next-line no-console
  console.log('[term-quote] Decrypted quote response:', quote);
  const premium = Number(quote?.TotalPremiumFirstYear);
  const cover = Number(quote?.SumAssured);
  if (!Number.isFinite(premium) || premium < 0 || !Number.isFinite(cover) || cover <= 0) {
    throw new Error('The term quote response did not include a valid premium and sum assured.');
  }
  return { premium, cover };
}
