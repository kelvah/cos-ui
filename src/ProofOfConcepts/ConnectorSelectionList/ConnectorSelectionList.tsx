import {
  ConnectorTypesOrderBy,
  ConnectorTypesSearch,
  fetchConnectorTypes,
} from '@apis/api';
import { useCos } from '@hooks/useCos';
import React, { FC, useCallback, useEffect, useState } from 'react';

import { ConnectorSelectionListCacheProvider } from './ConnectorSelectionListCache';
import { ConnectorSelectionListLayout } from './ConnectorSelectionListLayout';
import { fetchConnectorTypeLabels } from './apiExtensions';
import {
  ConnectorTypeLabelCount,
  FeaturedConnectorType,
} from './typeExtensions';

export type ConnectorSelectionListProps = {};
export const ConnectorSelectionList: FC<ConnectorSelectionListProps> = ({}) => {
  const { connectorsApiBasePath, getToken } = useCos();
  const [connectorTypes, setConnectorTypes] = useState<
    Array<FeaturedConnectorType> | undefined
  >(undefined);
  const [labels, setLabels] = useState<
    Array<ConnectorTypeLabelCount> | undefined
  >(undefined);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 20,
    total: 0,
  });
  const [orderBy, setOrderBy] = useState<ConnectorTypesOrderBy>({
    featured_rank: 'desc',
    name: 'asc',
  });
  const [search, setSearch] = useState<ConnectorTypesSearch>({
    name: '',
    label: [],
    pricing_tier: '',
  });
  const { page, size, total } = pagination;

  const onGetConnectorTypes = useCallback(
    ({ page, size, items, total }) => {
      setConnectorTypes(items);
      setPagination({ page, size, total });
    },
    [setConnectorTypes, setPagination]
  );

  const onGetConnectorTypeLabels = useCallback(
    ({ items }) => {
      setLabels(items);
    },
    [setLabels]
  );

  const doInitialFetchConnectorTypes = useCallback(() => {
    fetchConnectorTypes({
      accessToken: getToken,
      connectorsApiBasePath,
    })(
      {
        page,
        size,
        search,
        orderBy,
      },
      onGetConnectorTypes,
      () => {} // error case - TODO
    );
  }, [
    getToken,
    connectorsApiBasePath,
    onGetConnectorTypes,
    page,
    size,
    orderBy,
    search,
  ]);

  const doFetchConnectorTypeLabels = useCallback(() => {
    fetchConnectorTypeLabels({
      accessToken: getToken,
      connectorsApiBasePath,
    })(
      {
        search: {
          name: search.name,
          label: (search.label || []).filter(
            (label) => label === 'source' || label === 'sink'
          ),
        },
        orderBy,
      },
      onGetConnectorTypeLabels,
      () => {} // error case - TODO
    );
  }, [
    getToken,
    connectorsApiBasePath,
    onGetConnectorTypeLabels,
    orderBy,
    search,
  ]);

  const doSetOrderBy = useCallback(
    (column: string) => {
      setConnectorTypes(undefined);
      setLabels(undefined);
      const primarySort = Object.keys(orderBy)[0] || 'featured_rank';
      switch (column) {
        case 'featured_rank':
          if (primarySort === 'featured_rank') {
            setOrderBy({
              featured_rank: orderBy.featured_rank === 'desc' ? 'asc' : 'desc',
              name: orderBy.name === 'asc' ? 'desc' : 'asc',
            });
          } else {
            setOrderBy({
              featured_rank: 'desc',
              name: 'asc',
            });
          }
          break;
        case 'name':
          setOrderBy({
            name:
              primarySort !== 'name'
                ? 'asc'
                : orderBy.name === 'asc'
                ? 'desc'
                : 'asc',
          });
          break;
      }
    },
    [orderBy]
  );

  const doSetNameSearch = useCallback(
    (name: string) => {
      setConnectorTypes(undefined);
      setSearch({ ...search, name });
    },
    [setSearch, search]
  );

  const doSetPricingTierSearch = useCallback(
    async (pricingTier: string) => {
      setConnectorTypes(undefined);
      await setTimeout(
        () => setSearch({ ...search, pricing_tier: pricingTier }),
        0
      );
    },
    [setSearch, search]
  );

  const doSetLabelSearch = useCallback(
    async (label: Array<string>) => {
      setConnectorTypes(undefined);
      // this setTimeout is needed specifically for the filter checkbox click events
      await setTimeout(() => setSearch({ ...search, label }), 0);
    },
    [setSearch, search, setConnectorTypes]
  );

  const sortInputEntries = [
    {
      label: 'Sort by Name',
      value: 'name',
    },
    {
      label: 'Sort by Featured',
      value: 'featured_rank',
    },
  ];

  useEffect(() => {
    doInitialFetchConnectorTypes();
    doFetchConnectorTypeLabels();
  }, [doInitialFetchConnectorTypes, doFetchConnectorTypeLabels]);

  return (
    <>
      <ConnectorSelectionListCacheProvider
        connectorsApiBasePath={connectorsApiBasePath}
        getToken={getToken}
        search={search}
        orderBy={orderBy}
        initialSet={connectorTypes}
        page={page}
        size={size}
        total={total}
      >
        <ConnectorSelectionListLayout
          total={total}
          connectorTypesLoading={!!!connectorTypes}
          labels={labels}
          sortInputEntries={sortInputEntries}
          currentSort={orderBy}
          onChangeSort={doSetOrderBy}
          searchFieldValue={search.name || ''}
          searchFieldPlaceholder={'Search'}
          onChangeSearchField={doSetNameSearch}
          selectedCategories={search.label || []}
          onChangeLabelFilter={doSetLabelSearch}
          selectedPricingTier={search.pricing_tier || ''}
          onChangePricingTierFilter={doSetPricingTierSearch}
        />
      </ConnectorSelectionListCacheProvider>
    </>
  );
};
