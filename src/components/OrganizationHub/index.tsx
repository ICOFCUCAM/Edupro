import React, { useState, useEffect } from 'react';
import { Building2, Globe2, MapPin, Plus, Loader2, ChevronRight, School, Upload } from 'lucide-react';
import { getUserOrganizations, getOrganizationsByCountry, Organization, OrgRole } from '@/services/organizationService';
import { getUserHighestRole } from '@/lib/accessControl';
import MinistryDashboard from '../MinistryDashboard';
import DistrictDashboard from '../DistrictDashboard';
import SchoolDashboard from '../SchoolDashboard';
import BulkOnboarding from '../BulkOnboarding';

interface OrganizationHubProps {
  userId: string;
  userCountry?: string;
  onNavigate: (page: string) => void;
}

const TYPE_ICON = {
  ministry: Globe2,
  district: MapPin,
  school: School,
  ngo: Building2,
  training_center: Building2,
};

const TYPE_COLOR = {
  ministry: 'bg-blue-100 text-blue-700',
  district: 'bg-indigo-100 text-indigo-700',
  school: 'bg-emerald-100 text-emerald-700',
  ngo: 'bg-purple-100 text-purple-700',
  training_center: 'bg-amber-100 text-amber-700',
};

const OrganizationHub: React.FC<OrganizationHubProps> = ({ userId, userCountry, onNavigate }) => {
  const [myOrgs, setMyOrgs] = useState<Array<Organization & { role: OrgRole }>>([]);
  const [selected, setSelected] = useState<(Organization & { role?: OrgRole }) | null>(null);
  const [highestRole, setHighestRole] = useState<OrgRole | null>(null);
  const [showBulkOnboarding, setShowBulkOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrgs();
  }, [userId]);

  const loadOrgs = async () => {
    setLoading(true);
    const [orgs, role] = await Promise.all([
      getUserOrganizations(userId),
      getUserHighestRole(userId),
    ]);
    setMyOrgs(orgs);
    setHighestRole(role);

    // Auto-select single org or first ministry
    if (orgs.length === 1) {
      setSelected(orgs[0]);
    } else if (orgs.length > 1) {
      const ministry = orgs.find(o => o.type === 'ministry');
      if (ministry) setSelected(ministry);
    }

    setLoading(false);
  };

  const renderDashboard = (org: Organization & { role?: OrgRole }) => {
    switch (org.type) {
      case 'ministry':
        return <MinistryDashboard organization={org} onDrillDown={setSelected} />;
      case 'district':
        return <DistrictDashboard organization={org} />;
      case 'school':
      case 'ngo':
      case 'training_center':
        return <SchoolDashboard organization={org} userId={userId} userRole={org.role || 'teacher'} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (showBulkOnboarding) {
    return (
      <div>
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setShowBulkOnboarding(false)}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5">
            ← Back to Organizations
          </button>
        </div>
        <BulkOnboarding defaultCountry={userCountry} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Organization Hub</h1>
                <p className="text-blue-200 text-sm">Manage schools, districts, and ministry analytics</p>
              </div>
            </div>
            {(highestRole === 'ministry_admin' || highestRole === 'district_admin') && (
              <button onClick={() => setShowBulkOnboarding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all">
                <Upload className="w-4 h-4" /> Bulk Onboarding
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6 pb-16">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar: org list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">My Organizations</h3>

              {myOrgs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">You haven't joined any organization.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {myOrgs.map(org => {
                    const Icon = TYPE_ICON[org.type] || Building2;
                    const isActive = selected?.id === org.id;
                    return (
                      <button key={org.id} onClick={() => setSelected(org)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[org.type] || 'bg-gray-100 text-gray-600'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{org.name}</p>
                          <p className="text-[10px] text-gray-400 capitalize">{org.type} · {org.role}</p>
                        </div>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Main area */}
          <div className="lg:col-span-3">
            {selected ? (
              renderDashboard(selected)
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
                <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-900 mb-2">Select an Organization</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Choose a ministry, district, or school from the sidebar to view its dashboard and analytics.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationHub;
