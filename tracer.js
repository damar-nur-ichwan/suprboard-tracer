require('dotenv').config()

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes, SemanticAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { AlwaysOnSampler } = require('@opentelemetry/core');
const opentelemetry = require('@opentelemetry/api');

// Not functionally required but gives some insight what happens behind the scenes
const { diag, DiagConsoleLogger, DiagLogLevel } = opentelemetry;
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

module.exports = function (){

    //set exporter
    const Exporter = (process.env.EXPORTER || '').toLowerCase().startsWith('z') ? ZipkinExporter : JaegerExporter;
    const exporter = new Exporter({
        url: process.env.EXPORTER_URL+'/api/v2/spans',
        serviceName: process.env.INSTANCE_NAME,
    });

    //set & regist provider
    const provider = new NodeTracerProvider({
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.INSTANCE_NAME,
    }),
    sampler: filterSampler(ignoreHealthCheck, new AlwaysOnSampler()),
    });
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();

    //regist instrumentation
    registerInstrumentations({
        tracerProvider: provider,
        instrumentations: [getNodeAutoInstrumentations()]
    });

    return opentelemetry.trace.getTracer(require('./package.json')['name'])
}

function filterSampler(filterFn, parent) {
    return {
      shouldSample(ctx, tid, spanName, spanKind, attr, links) {
        if (!filterFn(spanName, spanKind, attr)) {
          return { decision: opentelemetry.SamplingDecision.NOT_RECORD };
        }
        return parent.shouldSample(ctx, tid, spanName, spanKind, attr, links);
      },
      toString() {
        return `FilterSampler(${parent.toString()})`;
      }
    }
  }
  
  function ignoreHealthCheck(spanName, spanKind, attributes) {
    return spanKind !== opentelemetry.SpanKind.SERVER || attributes[SemanticAttributes.HTTP_ROUTE] !== "/health";
  }