'use strict';

module.exports = async function (url,data,config) {
    
  // eslint-disable-next-line import/order
  const tracer = require('../../../tracer')();
  const api = require('@opentelemetry/api');
  const axios = require('axios').default;

  const span = tracer.startSpan('client.makeRequest()', {
    kind: api.SpanKind.CLIENT,
  });

  return api.context.with(api.trace.setSpan(api.ROOT_CONTEXT, span), async () => {
    try {
      const res = await axios.patch(url,data,config);
      console.log('status:', res.statusText);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return res
    } catch (e) {
      console.log('failed:', e.message);
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: e.message });
    }
    span.end();
  });
}
