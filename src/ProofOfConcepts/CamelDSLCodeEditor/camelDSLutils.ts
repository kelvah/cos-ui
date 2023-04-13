import { SchemasSettings, setDiagnosticsOptions } from 'monaco-yaml';

import schema from './camelDSLSchema.json';

export * from '@patternfly/react-code-editor';

const defaultSchema = {
  uri: 'http://console.redhat.com/docs',
  fileMatch: ['*'],
  schema,
};

setDiagnosticsOptions({
  enableSchemaRequest: true,
  hover: true,
  completion: true,
  validate: true,
  format: true,
  schemas: [defaultSchema as SchemasSettings],
});
