import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Clock3, ShieldCheck, Truck, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteJson, getJson, patchJson, postJson } from '../utils/api';

const emptyOverview = {
  summary: {},
  organizations: [],
  marketplace: {
    summary: {},
    listings: [],
    organizations: []
  },
  opportunities: [],
  requests: []
};

export default function MultiOrganizationCenter() {
  const { currentUser, getToken } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('all');
  const [overview, setOverview] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading cross-organization execution data...');
  const [updatingRequestId, setUpdatingRequestId] = useState(null);
  const [creatingRequestId, setCreatingRequestId] = useState(null);
  const [membershipActionId, setMembershipActionId] = useState(null);
  const [publishingListing, setPublishingListing] = useState(false);
  const [convertingListingId, setConvertingListingId] = useState(null);
  const [requestDrafts, setRequestDrafts] = useState({});
  const [exchangeTargets, setExchangeTargets] = useState({});
  const [listingDraft, setListingDraft] = useState({
    organizationId: 'org-central',
    listingType: 'offer',
    resourceType: 'inventory',
    title: '',
    detail: '',
    resourceCategory: 'Food',
    quantity: 20,
    unit: 'units',
    location: '',
    priority: 'watch'
  });
  const canManage = ['admin', 'coordinator'].includes(currentUser?.role);
  const joinedCommunities = organizations.filter((organization) => organization.isMember);
  const networkOrganizations = useMemo(() => (
    (overview.organizations || []).map((organization) => {
      const membershipRow = organizations.find((entry) => String(entry.id) === String(organization.id));
      return {
        ...organization,
        memberCount: membershipRow?.memberCount || 0,
        isMember: Boolean(membershipRow?.isMember)
      };
    })
  ), [organizations, overview.organizations]);

  const organizationQuery = selectedOrganizationId === 'all' ? '' : `?orgId=${encodeURIComponent(selectedOrganizationId)}`;
  const marketplace = overview.marketplace || emptyOverview.marketplace;
  const marketplaceListings = Array.isArray(marketplace.listings) ? marketplace.listings : [];
  const summaryCards = useMemo(() => ([
    { label: 'Requests', value: overview.summary?.totalRequests || 0, icon: <ArrowRightLeft size={18} color="var(--accent-cyan)" /> },
    { label: 'Fulfillment Rate', value: `${overview.summary?.fulfillmentRate || 0}%`, icon: <ShieldCheck size={18} color="var(--accent-green)" /> },
    { label: 'Avg Approval', value: `${overview.summary?.averageApprovalHours || 0}h`, icon: <Clock3 size={18} color="var(--accent-orange)" /> },
    { label: 'Avg Delivery', value: `${overview.summary?.averageDeliveryHours || 0}h`, icon: <Truck size={18} color="var(--accent-purple)" /> }
  ]), [overview.summary]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = currentUser ? await getToken() : null;
      const [organizationsData, overviewData] = await Promise.all([
        getJson('/api/organizations', { token }),
        getJson(`/api/network/overview${organizationQuery}`)
      ]);

      setOrganizations(Array.isArray(organizationsData) ? organizationsData : []);
      setOverview(overviewData?.success ? overviewData : emptyOverview);
      setRequestDrafts((current) => buildRequestDrafts(overviewData?.requests || [], current));
      setMessage(selectedOrganizationId === 'all'
        ? 'Network command view is live across every partner organization.'
        : `${organizationsData.find?.((org) => String(org.id) === String(selectedOrganizationId))?.name || 'Selected organization'} is now active in the network command view.`);
    } catch (error) {
      console.error(error);
      setOverview(emptyOverview);
      setMessage(`Unable to load multi-organization operations. ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOrganizationId]);

  useEffect(() => {
    if (selectedOrganizationId !== 'all') {
      setListingDraft((current) => ({ ...current, organizationId: selectedOrganizationId }));
    }
  }, [selectedOrganizationId]);

  const handleCommunityMembership = async (organization, nextAction) => {
    if (!currentUser) {
      setMessage('Sign in to join or leave communities from the network workspace.');
      return;
    }

    setMembershipActionId(organization.id);
    try {
      const token = await getToken();
      if (nextAction === 'join') {
        await postJson(`/api/network/communities/${encodeURIComponent(organization.id)}/join`, {}, { token });
        setMessage(`You joined ${organization.name}. Its network activity will stay visible in your community workspace.`);
      } else {
        await deleteJson(`/api/network/communities/${encodeURIComponent(organization.id)}/leave`, { token });
        setMessage(`You left ${organization.name}. You can still monitor it from the all-organizations view.`);
      }
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage(`${nextAction === 'join' ? 'Failed to join' : 'Failed to leave'} ${organization.name}. ${error.message}`);
    } finally {
      setMembershipActionId(null);
    }
  };

  const handleCreateRequest = async (opportunity) => {
    setCreatingRequestId(opportunity.id);
    try {
      const token = await getToken();
      const data = await postJson('/api/network/requests', {
        type: opportunity.type,
        priority: opportunity.priority,
        summary: opportunity.summary,
        detail: opportunity.detail,
        resourceCategory: opportunity.resourceCategory,
        relatedNeedId: opportunity.relatedNeedId || null,
        relatedInventoryItemId: opportunity.relatedInventoryItemId || null,
        requestingOrganizationId: opportunity.requestingOrganizationId,
        requestingOrganizationName: opportunity.requestingOrganizationName,
        requestingOrganizationShortName: opportunity.requestingOrganizationShortName,
        supportingOrganizationId: opportunity.supportingOrganizationId,
        supportingOrganizationName: opportunity.supportingOrganizationName,
        supportingOrganizationShortName: opportunity.supportingOrganizationShortName,
        suggestedUnits: opportunity.suggestedUnits,
        candidateCount: opportunity.candidateCount,
        recommendedVolunteerIds: opportunity.recommendedVolunteerIds || [],
        recommendedInventoryItemIds: opportunity.recommendedInventoryItemIds || []
      }, { token });
      setMessage(`Mutual aid request opened between ${opportunity.requestingOrganizationShortName} and ${opportunity.supportingOrganizationShortName}.`);
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage(`Failed to create mutual aid request. ${error.message}`);
    } finally {
      setCreatingRequestId(null);
    }
  };

  const handlePublishListing = async () => {
    setPublishingListing(true);
    try {
      const token = await getToken();
      const payload = {
        ...listingDraft,
        quantity: Number(listingDraft.quantity) || 0
      };
      await postJson('/api/network/marketplace/listings', payload, { token });
      setListingDraft((current) => ({
        ...current,
        title: '',
        detail: '',
        quantity: current.listingType === 'offer' ? 20 : 5,
        location: ''
      }));
      setMessage('Marketplace listing published. Partner organizations can now turn it into a live exchange.');
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage(`Failed to publish marketplace listing. ${error.message}`);
    } finally {
      setPublishingListing(false);
    }
  };

  const handleOpenExchange = async (listing) => {
    setConvertingListingId(listing.id);
    try {
      const token = await getToken();
      const fallbackTarget = organizations.find((organization) => String(organization.id) !== String(listing.organizationId));
      const counterpartyOrganizationId = exchangeTargets[listing.id] || (selectedOrganizationId !== 'all' && String(selectedOrganizationId) !== String(listing.organizationId)
        ? selectedOrganizationId
        : fallbackTarget?.id);

      if (!counterpartyOrganizationId) {
        throw new Error('Select a partner organization first');
      }

      await postJson('/api/network/marketplace/exchanges', {
        listing,
        counterpartyOrganizationId
      }, { token });
      setMessage(`Marketplace exchange opened for ${listing.title}. It is now tracked in the execution queue.`);
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage(`Failed to open marketplace exchange. ${error.message}`);
    } finally {
      setConvertingListingId(null);
    }
  };

  const handleWorkflowAction = async (request, action) => {
    setUpdatingRequestId(request.id);
    try {
      const token = await getToken();
      const draft = requestDrafts[request.id] || {};
      const data = await patchJson(`/api/network/requests/${encodeURIComponent(request.id)}/status`, {
        action,
        note: draft.note || '',
        transferQuantity: draft.transferQuantity ?? request.transfer?.quantity ?? request.suggestedUnits,
        transferUnit: draft.transferUnit ?? request.transfer?.unit ?? 'units',
        transportMode: draft.transportMode ?? request.transfer?.mode ?? '',
        eta: draft.eta ?? request.transfer?.eta ?? '',
        supportingContact: draft.supportingContact ?? request.transfer?.supportingContact ?? '',
        receivingContact: draft.receivingContact ?? request.transfer?.receivingContact ?? '',
        handoffLocation: draft.handoffLocation ?? request.transfer?.handoffLocation ?? '',
        transferNotes: draft.transferNotes ?? request.transfer?.notes ?? '',
        receiptNote: draft.receiptNote ?? request.verification?.receiptNote ?? '',
        evidenceSummary: draft.evidenceSummary ?? request.verification?.evidenceSummary ?? '',
        impactSummary: draft.impactSummary ?? request.verification?.impactSummary ?? '',
        beneficiaryDelta: Number(draft.beneficiaryDelta ?? request.verification?.beneficiaryDelta) || 0
      }, { token });
      setMessage(`Request updated: ${formatNetworkRequestStatus(data.request.status)}.`);
      await fetchData();
    } catch (error) {
      console.error(error);
      setMessage(`Workflow update failed. ${error.message}`);
    } finally {
      setUpdatingRequestId(null);
    }
  };

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section className="glass-panel" style={{ padding: 'clamp(1.6rem, 4vw, 2.4rem)', background: 'linear-gradient(140deg, rgba(0,198,255,0.08), rgba(8,12,20,0.9) 45%, rgba(255,149,0,0.08))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <ArrowRightLeft size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Phase 3 multi-organization execution</span>
            </div>
            <div>
              <h1 className="text-gradient">Network Command Center</h1>
              <p className="text-muted" style={{ marginTop: '0.65rem', maxWidth: '68ch' }}>
                This dedicated page turns mutual aid into an auditable operational workflow: approval, transit, delivery, verification, closure, and measurable inter-organization performance.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
              <Link to="/analytics" className="btn-primary">Open Analytics</Link>
            </div>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{message}</p>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.9rem' }}>
            <div>
              <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Organization Scope</p>
              <p style={{ marginTop: '0.3rem', fontSize: '0.9rem' }}>Use the selector to isolate one organization or coordinate across the full network.</p>
            </div>
            <select
              value={selectedOrganizationId}
              onChange={(event) => setSelectedOrganizationId(event.target.value)}
              className="input-field"
              style={{ appearance: 'none' }}
            >
              <option value="all">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} ({organization.shortName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {summaryCards.map((card) => (
          <div key={card.label} className="glass-panel" style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</p>
              <h2 style={{ fontSize: '1.85rem', marginTop: '0.22rem' }}>{card.value}</h2>
            </div>
            <div style={{ width: '2.8rem', height: '2.8rem', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center' }}>
              {card.icon}
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
            <div>
              <h3>Resource Marketplace</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
                A live exchange board where partners can publish offers, request help, and open transfer workflows in one step.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Open offers', value: marketplace.summary?.openOffers || 0 },
                { label: 'Open requests', value: marketplace.summary?.openRequests || 0 },
                { label: 'Active exchanges', value: marketplace.summary?.activeExchanges || 0 },
                { label: 'Auto supply', value: marketplace.summary?.automatedOffers || 0 }
              ].map((stat) => (
                <div key={stat.label} className="glass-panel" style={{ minWidth: '120px', padding: '0.75rem 0.85rem', background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</p>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.18rem' }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {marketplaceListings.map((listing) => {
              const partnerOptions = organizations.filter((organization) => String(organization.id) !== String(listing.organizationId));
              const selectedTarget = exchangeTargets[listing.id]
                || (selectedOrganizationId !== 'all' && String(selectedOrganizationId) !== String(listing.organizationId) ? selectedOrganizationId : partnerOptions[0]?.id || '');
              const actionLabel = listing.listingType === 'offer' ? 'Request This Offer' : 'Support This Request';

              return (
                <div key={listing.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.85rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{listing.title}</p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.18rem' }}>{listing.detail}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={listing.listingType === 'offer' ? getStatusStyle('approved_support') : getPriorityStyle(listing.priority)}>{listing.listingType === 'offer' ? 'Offer' : 'Request'}</span>
                      <span style={getPriorityStyle(listing.priority)}>{formatPriority(listing.priority)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
                    {[
                      { label: 'Organization', value: listing.organizationShortName || listing.organizationName },
                      { label: 'Resource', value: `${listing.quantity || 0} ${listing.unit || 'units'}` },
                      { label: 'Category', value: listing.resourceCategory || 'General' },
                      { label: 'Source', value: formatListingSource(listing.source) }
                    ].map((row) => (
                      <div key={`${listing.id}-${row.label}`} className="glass-panel" style={{ padding: '0.72rem', background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</p>
                        <p style={{ fontWeight: 700, marginTop: '0.16rem' }}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                  {listing.certificationHints?.length ? (
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                      Certification fit: {listing.certificationHints.join(', ')}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'grid', gap: '0.35rem', minWidth: '220px', flex: '1 1 240px' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>
                        {listing.listingType === 'offer' ? 'Receiving organization' : 'Supporting organization'}
                      </span>
                      <select
                        className="input-field"
                        value={selectedTarget}
                        onChange={(event) => setExchangeTargets((current) => ({ ...current, [listing.id]: event.target.value }))}
                      >
                        {partnerOptions.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name} ({organization.shortName})
                          </option>
                        ))}
                      </select>
                    </label>
                    {canManage ? (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={convertingListingId === listing.id || !partnerOptions.length}
                        onClick={() => handleOpenExchange(listing)}
                      >
                        {convertingListingId === listing.id ? 'Opening...' : actionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!marketplaceListings.length ? (
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>No exchange listings are open right now.</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>Publish an offer or a request to seed the resource marketplace for partner organizations.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,198,255,0.05))' }}>
          <div>
            <h3>Publish Listing</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Publish a direct offer or a request so the network can act before a coordinator manually scouts for support.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Organization</span>
                <select className="input-field" value={listingDraft.organizationId} onChange={(event) => setListingDraft((current) => ({ ...current, organizationId: event.target.value }))}>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} ({organization.shortName})
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Listing type</span>
                <select className="input-field" value={listingDraft.listingType} onChange={(event) => setListingDraft((current) => ({ ...current, listingType: event.target.value }))}>
                  <option value="offer">Offer</option>
                  <option value="request">Request</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Resource type</span>
                <select className="input-field" value={listingDraft.resourceType} onChange={(event) => setListingDraft((current) => ({ ...current, resourceType: event.target.value }))}>
                  <option value="inventory">Inventory</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Priority</span>
                <select className="input-field" value={listingDraft.priority} onChange={(event) => setListingDraft((current) => ({ ...current, priority: event.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="watch">Watch</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="text-muted" style={{ fontSize: '0.76rem' }}>Title</span>
              <input className="input-field" value={listingDraft.title} onChange={(event) => setListingDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Example: Westside needs logistics runners" />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span className="text-muted" style={{ fontSize: '0.76rem' }}>Detail</span>
              <textarea className="input-field" rows="3" value={listingDraft.detail} onChange={(event) => setListingDraft((current) => ({ ...current, detail: event.target.value }))} placeholder="What can be shared or what support is needed?" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Category</span>
                <input className="input-field" value={listingDraft.resourceCategory} onChange={(event) => setListingDraft((current) => ({ ...current, resourceCategory: event.target.value }))} placeholder="Food / Medical / Logistics" />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Quantity</span>
                <input className="input-field" type="number" min="1" value={listingDraft.quantity} onChange={(event) => setListingDraft((current) => ({ ...current, quantity: Number(event.target.value) || 0 }))} />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Unit</span>
                <input className="input-field" value={listingDraft.unit} onChange={(event) => setListingDraft((current) => ({ ...current, unit: event.target.value }))} placeholder="packs / volunteers / kits" />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="text-muted" style={{ fontSize: '0.76rem' }}>Location</span>
                <input className="input-field" value={listingDraft.location} onChange={(event) => setListingDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Warehouse / Hub / Field site" />
              </label>
            </div>
            {canManage ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={publishingListing || !listingDraft.organizationId || !listingDraft.title.trim()}
                  onClick={handlePublishListing}
                >
                  {publishingListing ? 'Publishing...' : 'Publish To Marketplace'}
                </button>
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>Admins and coordinators can publish marketplace listings.</p>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Partner Pressure Map</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              These cards show where the network is under strain and where support capacity currently exists.
            </p>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Joined communities: <span style={{ color: 'var(--accent-cyan)' }}>{joinedCommunities.length}</span>
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {networkOrganizations.map((organization) => (
              <div key={organization.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{organization.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.16rem' }}>{organization.shortName} • {organization.type || 'Partner organization'}</p>
                  </div>
                  <span style={{ padding: '0.32rem 0.68rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                    {organization.activeNetworkRequests || 0} active
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }}>
                    {[
                      { label: 'Open spots', value: organization.openSpots || 0 },
                      { label: 'Critical', value: organization.criticalNeedCount || 0 },
                      { label: 'Low stock', value: organization.lowInventoryCount || 0 },
                      { label: 'Members', value: organization.memberCount || 0 }
                  ].map((row) => (
                    <div key={`${organization.id}-${row.label}`} className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</p>
                      <p style={{ fontWeight: 700, marginTop: '0.16rem' }}>{row.value}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {organization.isMember
                      ? 'This community is pinned to your collaboration workspace.'
                      : 'Join to keep this partner in your active collaboration network.'}
                  </p>
                  <button
                    type="button"
                    className={organization.isMember ? 'btn-secondary' : 'btn-primary'}
                    disabled={membershipActionId === organization.id}
                    onClick={() => handleCommunityMembership(organization, organization.isMember ? 'leave' : 'join')}
                  >
                    {membershipActionId === organization.id
                      ? (organization.isMember ? 'Leaving...' : 'Joining...')
                      : (organization.isMember ? 'Leave Community' : 'Join Community')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,255,136,0.03))' }}>
          <div>
            <h3>Lifecycle Logic</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Phase 3 now tracks mutual aid from approval through verified receipt and closure.
            </p>
          </div>
          {[
            { label: 'Requested', icon: <Zap size={16} color="var(--accent-orange)" />, body: 'Receiving organization confirms the need and opens a formal request.' },
            { label: 'Support Approved', icon: <Users size={16} color="var(--accent-cyan)" />, body: 'Supporting organization commits staff or inventory and enters transfer details.' },
            { label: 'In Transit', icon: <Truck size={16} color="var(--accent-purple)" />, body: 'Transport is live with ETA, contacts, and handoff location.' },
            { label: 'Delivered / Verified / Closed', icon: <ShieldCheck size={16} color="var(--accent-green)" />, body: 'Receipt is confirmed, impact is verified, and the request is formally closed.' }
          ].map((step) => (
            <div key={step.label} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.8rem' }}>
              <div style={{ width: '2.35rem', height: '2.35rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>{step.icon}</div>
              <div>
                <p style={{ fontWeight: 700 }}>{step.label}</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.18rem' }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(320px, 1.05fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Recommended Mutual Aid Opportunities</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              These are fresh opportunities generated from live need pressure, badge fit, and inventory imbalance.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {(overview.opportunities || []).map((opportunity) => (
              <div key={opportunity.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{opportunity.summary}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{opportunity.detail}</p>
                  </div>
                  <span style={getPriorityStyle(opportunity.priority)}>{formatPriority(opportunity.priority)}</span>
                </div>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {opportunity.requestingOrganizationShortName} needs help from {opportunity.supportingOrganizationShortName} • Suggested quantity {opportunity.suggestedUnits}
                </p>
                {canManage ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleCreateRequest(opportunity)}
                      disabled={creatingRequestId === opportunity.id}
                    >
                      {creatingRequestId === opportunity.id ? 'Opening...' : 'Open Request'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!overview.opportunities?.length ? (
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>No new recommendations right now.</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>As cross-organization strain appears, recommended staffing and inventory transfers will surface here.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Execution Queue</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Use this queue to manage approvals, transport planning, receipt verification, and request closure.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {(overview.requests || []).map((request) => {
              const draft = requestDrafts[request.id] || {};

              return (
                <div key={request.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{request.summary}</p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        {request.requestingOrganizationShortName} to {request.supportingOrganizationShortName} • {request.resourceCategory}
                      </p>
                    </div>
                    <span style={getStatusStyle(request.status)}>{formatNetworkRequestStatus(request.status)}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>Quantity</span>
                      <input className="input-field" type="number" min="0" value={draft.transferQuantity ?? request.transfer?.quantity ?? request.suggestedUnits ?? 0} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), transferQuantity: Number(event.target.value) || 0 } }))} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>Transport mode</span>
                      <input className="input-field" value={draft.transportMode ?? request.transfer?.mode ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), transportMode: event.target.value } }))} placeholder="Van, bike courier, shuttle" />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>ETA</span>
                      <input className="input-field" value={draft.eta ?? request.transfer?.eta ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), eta: event.target.value } }))} placeholder="Today 18:30" />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>Handoff location</span>
                      <input className="input-field" value={draft.handoffLocation ?? request.transfer?.handoffLocation ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), handoffLocation: event.target.value } }))} placeholder="Hub, depot, field site" />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>Supporting contact</span>
                      <input className="input-field" value={draft.supportingContact ?? request.transfer?.supportingContact ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), supportingContact: event.target.value } }))} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.76rem' }}>Receiving contact</span>
                      <input className="input-field" value={draft.receivingContact ?? request.transfer?.receivingContact ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), receivingContact: event.target.value } }))} />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <textarea className="input-field" rows="2" value={draft.note ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), note: event.target.value } }))} placeholder="Workflow note for this transition" />
                    <textarea className="input-field" rows="2" value={draft.receiptNote ?? request.verification?.receiptNote ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), receiptNote: event.target.value } }))} placeholder="Receipt / handoff note" />
                    <textarea className="input-field" rows="2" value={draft.impactSummary ?? request.verification?.impactSummary ?? ''} onChange={(event) => setRequestDrafts((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), impactSummary: event.target.value } }))} placeholder="Impact summary after support lands" />
                  </div>

                  {canManage ? (
                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {request.status === 'requested' ? <button type="button" className="btn-secondary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'approve_support')}>{updatingRequestId === request.id ? 'Updating...' : 'Approve Support'}</button> : null}
                      {request.status === 'approved_support' ? <button type="button" className="btn-secondary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'mark_in_transit')}>{updatingRequestId === request.id ? 'Updating...' : 'Mark In Transit'}</button> : null}
                      {request.status === 'in_transit' ? <button type="button" className="btn-secondary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'confirm_delivery')}>{updatingRequestId === request.id ? 'Updating...' : 'Confirm Delivery'}</button> : null}
                      {request.status === 'delivered' ? <button type="button" className="btn-secondary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'verify_receipt')}>{updatingRequestId === request.id ? 'Updating...' : 'Verify Receipt'}</button> : null}
                      {request.status === 'verified' ? <button type="button" className="btn-primary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'close_request')}>{updatingRequestId === request.id ? 'Updating...' : 'Close Request'}</button> : null}
                      {!['closed', 'cancelled'].includes(request.status) ? <button type="button" className="btn-secondary" disabled={updatingRequestId === request.id} onClick={() => handleWorkflowAction(request, 'cancel_request')} style={{ borderColor: 'rgba(255,99,132,0.35)', color: 'var(--accent-red)' }}>{updatingRequestId === request.id ? 'Updating...' : 'Cancel'}</button> : null}
                    </div>
                  ) : null}

                  {request.history?.length ? (
                    <div className="glass-panel" style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.55rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.84rem' }}>Workflow history</p>
                      {request.history.slice().reverse().slice(0, 4).map((entry) => (
                        <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                          <p className="text-muted" style={{ fontSize: '0.78rem' }}>{entry.note}</p>
                          <p className="text-muted" style={{ fontSize: '0.76rem' }}>{formatDateTime(entry.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!overview.requests?.length ? (
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>No active execution requests yet.</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>Open a recommendation to begin the multi-organization lifecycle.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="glass-panel" style={{ padding: '1.4rem' }}>
          <p className="text-muted">Refreshing network execution data...</p>
        </div>
      ) : null}
    </div>
  );
}

function buildRequestDrafts(requests, current) {
  const next = { ...current };
  requests.forEach((request) => {
    next[request.id] = {
      ...(next[request.id] || {}),
      transferQuantity: next[request.id]?.transferQuantity ?? request.transfer?.quantity ?? request.suggestedUnits ?? 0,
      transferUnit: next[request.id]?.transferUnit ?? request.transfer?.unit ?? 'units',
      transportMode: next[request.id]?.transportMode ?? request.transfer?.mode ?? '',
      eta: next[request.id]?.eta ?? request.transfer?.eta ?? '',
      handoffLocation: next[request.id]?.handoffLocation ?? request.transfer?.handoffLocation ?? '',
      supportingContact: next[request.id]?.supportingContact ?? request.transfer?.supportingContact ?? '',
      receivingContact: next[request.id]?.receivingContact ?? request.transfer?.receivingContact ?? '',
      note: next[request.id]?.note ?? '',
      receiptNote: next[request.id]?.receiptNote ?? request.verification?.receiptNote ?? '',
      impactSummary: next[request.id]?.impactSummary ?? request.verification?.impactSummary ?? ''
    };
  });
  return next;
}

function formatPriority(priority = 'watch') {
  if (priority === 'critical') return 'Critical';
  if (priority === 'high') return 'High';
  if (priority === 'watch') return 'Watch';
  return 'Normal';
}

function getPriorityStyle(priority = 'watch') {
  if (priority === 'critical') {
    return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,59,48,0.14)', color: 'var(--accent-red)', fontSize: '0.76rem', fontWeight: 700 };
  }
  if (priority === 'high') {
    return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,149,0,0.14)', color: 'var(--accent-orange)', fontSize: '0.76rem', fontWeight: 700 };
  }
  return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(0,240,255,0.1)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 };
}

function formatNetworkRequestStatus(status = 'requested') {
  if (status === 'approved_support') return 'Support Approved';
  if (status === 'in_transit') return 'In Transit';
  if (status === 'delivered') return 'Delivered';
  if (status === 'verified') return 'Verified';
  if (status === 'closed') return 'Closed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Requested';
}

function formatListingSource(source = 'manual') {
  if (source === 'inventory_auto') return 'Auto inventory';
  if (source === 'volunteer_auto') return 'Auto volunteer';
  return 'Manual';
}

function getStatusStyle(status = 'requested') {
  if (status === 'closed') return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(0,255,136,0.12)', color: 'var(--accent-green)', fontSize: '0.76rem', fontWeight: 700 };
  if (status === 'approved_support' || status === 'in_transit') return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(0,240,255,0.1)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 };
  if (status === 'cancelled') return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 700 };
  if (status === 'delivered') return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,209,102,0.14)', color: '#ffd166', fontSize: '0.76rem', fontWeight: 700 };
  return { padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,149,0,0.14)', color: 'var(--accent-orange)', fontSize: '0.76rem', fontWeight: 700 };
}

function formatDateTime(value) {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return parsed.toLocaleString();
}
