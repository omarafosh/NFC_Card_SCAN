import crypto from 'crypto';

// 1. UUID Validation Test
const customer_id_bad = "2";
const isValidUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

console.log(`Testing Validation for id="${customer_id_bad}":`);
let validCustomerId = customer_id_bad;
if (customer_id_bad && !isValidUuid(customer_id_bad)) {
    console.log(`✅ Failed UUID check (Correct Behavior). Setting to null.`);
    validCustomerId = null;
} else {
    console.log(`❌ Passed UUID check (Unexpected!).`);
}

// 2. Hash Generation Test
const globalSignature = 'yamen';
const signature = crypto.createHash('sha256').update(globalSignature).digest('hex').substring(0, 16).toUpperCase();
console.log(`\nHashed Signature for "${globalSignature}":`, signature);
console.log('\nLogic Verification Complete.');
