/* eslint-disable camelcase, no-underscore-dangle */
const jsonschema_1 = require("jsonschema");
const _ = require("lodash");

exports.ValidatorResult = jsonschema_1.ValidatorResult;

const basic_type_schemas_1 = require("@0xproject/json-schemas/lib/schemas/basic_type_schemas.js");
const ec_signature_schema_1 = require("@0xproject/json-schemas/lib/schemas/ec_signature_schema.js");
const order_schemas_1 = require("./bZx_order_schemas.js");

exports.schemas = {
  numberSchema: basic_type_schemas_1.numberSchema,
  addressSchema: basic_type_schemas_1.addressSchema,
  ecSignatureSchema: ec_signature_schema_1.ecSignatureSchema,
  ecSignatureParameterSchema: ec_signature_schema_1.ecSignatureParameterSchema,
  loanOrderSchema: order_schemas_1.loanOrderSchema,
  signedLoanOrderSchema: order_schemas_1.signedLoanOrderSchema
};

const SchemaValidator = (function() {
  // eslint-disable-next-line no-shadow
  function SchemaValidator() {
    this.validator = new jsonschema_1.Validator();
    // eslint-disable-next-line no-plusplus
    for (let _i = 0, _a = _.values(exports.schemas); _i < _a.length; _i++) {
      const schema = _a[_i];
      this.validator.addSchema(schema, schema.id);
    }
  }
  SchemaValidator.prototype.addSchema = function(schema) {
    this.validator.addSchema(schema, schema.id);
  };
  // In order to validate a complex JS object using jsonschema, we must replace any complex
  // sub-types (e.g BigNumber) with a simpler string representation. Since BigNumber and other
  // complex types implement the `toString` method, we can stringify the object and
  // then parse it. The resultant object can then be checked using jsonschema.
  SchemaValidator.prototype.validate = function(instance, schema) {
    const jsonSchemaCompatibleObject = JSON.parse(JSON.stringify(instance));
    return this.validator.validate(jsonSchemaCompatibleObject, schema);
  };
  SchemaValidator.prototype.isValid = function(instance, schema) {
    const isValid = this.validate(instance, schema).errors.length === 0;
    return isValid;
  };
  return SchemaValidator;
})();
exports.SchemaValidator = SchemaValidator;
