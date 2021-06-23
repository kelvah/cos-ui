import { getPaginatedApiMachineEventsHandlers } from './../shared/PaginatedResponseMachine';
import axios from 'axios';
import { useCallback } from 'react';
import {
  ActorRefFrom,
  assign,
  createMachine,
  createSchema,
  send,
  sendParent,
} from 'xstate';
import { createModel } from 'xstate/lib/model';

import {
  Configuration,
  ConnectorCluster,
  ConnectorClustersApi,
  KafkaRequest,
} from '@cos-ui/api';
import { useSelector } from '@xstate/react';

import {
  ApiCallback,
  ApiSuccessResponse,
  makePaginatedApiMachine,
  PaginatedApiActorType,
  getPaginatedApiMachineEvents,
  PaginatedApiRequest,
  usePagination,
} from '../shared';

const PAGINATED_MACHINE_ID = 'paginatedApi';

const fetchClusters = (
  accessToken?: Promise<string>,
  basePath?: string
): ApiCallback<ConnectorCluster, {}> => {
  const apisService = new ConnectorClustersApi(
    new Configuration({
      accessToken,
      basePath,
    })
  );
  return (request, onSuccess, onError) => {
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    const { page, size } = request;
    apisService
      .listConnectorClusters(`${page}`, `${size}`, {
        cancelToken: source.token,
      })
      .then(response => {
        onSuccess({
          items: response.data.items,
          total: response.data.total,
          page: response.data.page,
          size: response.data.size,
        });
      })
      .catch(error => {
        if (!axios.isCancel(error)) {
          onError({ error: error.message, page: request.page });
        }
      });
    return () => {
      source.cancel('Operation canceled by the user.');
    };
  };
};

type Context = {
  authToken?: Promise<string>;
  basePath?: string;
  response?: ApiSuccessResponse<ConnectorCluster>;
  selectedCluster?: ConnectorCluster;
  error?: Object;
};

const clustersMachineSchema = {
  context: createSchema<Context>(),
};

const clustersMachineModel = createModel(
  {
    authToken: undefined,
    basePath: undefined,
    clusters: undefined,
    selectedCluster: undefined,
    error: undefined,
  } as Context,
  {
    events: {
      selectCluster: (payload: { selectedCluster: string }) => ({
        ...payload,
      }),
      deselectCluster: () => ({}),
      confirm: () => ({}),
      ...getPaginatedApiMachineEvents<KafkaRequest, {}, KafkaRequest>(),
    },
  }
);

export const clustersMachine = createMachine<typeof clustersMachineModel>(
  {
    schema: clustersMachineSchema,
    id: 'clusters',
    initial: 'root',
    context: clustersMachineModel.initialContext,
    states: {
      root: {
        type: 'parallel',
        states: {
          api: {
            initial: 'idle',
            invoke: {
              id: PAGINATED_MACHINE_ID,
              src: context =>
                makePaginatedApiMachine<KafkaRequest, {}, KafkaRequest>(
                  fetchClusters(context.authToken, context.basePath),
                  i => i
                ),
            },
            states: {
              idle: {
                entry: send('query', { to: PAGINATED_MACHINE_ID }),
                on: {
                  ready: 'ready',
                },
              },
              ready: {},
            },
            on: {
              ...getPaginatedApiMachineEventsHandlers(PAGINATED_MACHINE_ID),
              success: { actions: 'success' },
            },
          },
          selection: {
            id: 'selection',
            initial: 'verify',
            states: {
              verify: {
                always: [
                  { target: 'selecting', cond: 'noClusterSelected' },
                  { target: 'valid', cond: 'clusterSelected' },
                ],
              },
              selecting: {
                entry: sendParent('isInvalid'),
                on: {
                  selectCluster: {
                    target: 'valid',
                    actions: 'selectCluster',
                  },
                },
              },
              valid: {
                entry: sendParent('isValid'),
                on: {
                  selectCluster: {
                    target: 'verify',
                    actions: 'selectCluster',
                    cond: (_, event) => event.selectedCluster !== undefined,
                  },
                  deselectCluster: {
                    target: 'verify',
                    actions: 'reset',
                  },
                  confirm: {
                    target: '#done',
                    cond: 'clusterSelected',
                  },
                },
              },
            },
          },
        },
      },
      done: {
        id: 'done',
        type: 'final',
        data: {
          selectedCluster: (context: Context) => context.selectedCluster,
        },
      },
    },
  },
  {
    actions: {
      success: assign((_context, event) => {
        if (event.type !== 'success') return {};
        const { type, ...response } = event;
        return {
          response,
        };
      }),
      selectCluster: assign({
        selectedCluster: (context, event) => {
          if (event.type === 'selectCluster') {
            return context.response?.items?.find(
              i => i.id === event.selectedCluster
            );
          }
          return context.selectedCluster;
        },
      }),
      reset: assign({
        selectedCluster: (context, event) =>
          event.type === 'deselectCluster'
            ? undefined
            : context.selectedCluster,
      }),
    },
    guards: {
      clusterSelected: context => context.selectedCluster !== undefined,
      noClusterSelected: context => context.selectedCluster === undefined,
    },
  }
);

export type ClustersMachineActorRef = ActorRefFrom<typeof clustersMachine>;

export const useClustersMachineIsReady = (actor: ClustersMachineActorRef) => {
  return useSelector(
    actor,
    useCallback(
      (state: typeof actor.state) => {
        return state.matches({ root: { api: 'ready' } });
      },
      [actor]
    )
  );
};

export const useClustersMachine = (actor: ClustersMachineActorRef) => {
  const api = usePagination<ConnectorCluster, {}, ConnectorCluster>(
    actor.state.children[PAGINATED_MACHINE_ID] as PaginatedApiActorType<
      ConnectorCluster,
      {},
      ConnectorCluster
    >
  );
  const { selectedId } = useSelector(
    actor,
    useCallback(
      (state: typeof actor.state) => ({
        selectedId: state.context.selectedCluster?.id,
      }),
      [actor]
    )
  );
  const onSelect = useCallback(
    (selectedCluster: string) => {
      actor.send({ type: 'selectCluster', selectedCluster });
    },
    [actor]
  );
  const onQuery = useCallback(
    (request: PaginatedApiRequest<{}>) => {
      actor.send({ type: 'query', ...request });
    },
    [actor]
  );
  return {
    ...api,
    selectedId,
    onSelect,
    onQuery,
  };
};
