
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { categorizeIssue } from '@/utils/aiCategorization.js';
import { getCurrentLocation, reverseGeocode } from '@/utils/location.js';
import { complaintsApi, chatApi } from '@/lib/api.js';
import DashboardLayout from '@/components/DashboardLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useToast } from '@/components/ui/use-toast.js';
import { MapPin, Loader2, ArrowLeft, Sparkles, AlertTriangle, CheckCircle2, ShieldCheck, Info, Camera, Upload } from 'lucide-react';
import exifr from 'exifr';

// Haversine formula — returns distance in km between two GPS points
const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const THRESHOLD_KM = 1; // max allowed distance between photo GPS and live GPS

const ReportIssue = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [formData, setFormData] = useState({ title: '', description: '' });
    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationAddress, setLocationAddress] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

    // EXIF verification states
    const [exifGps, setExifGps] = useState(null);          // { latitude, longitude } from photo EXIF
    const [locationMismatch, setLocationMismatch] = useState(false); // true if distance > threshold
    const [mismatchDistKm, setMismatchDistKm] = useState(null);
    const [noExifGps, setNoExifGps] = useState(false);     // photo has no embedded GPS

    const handleGenerateDescription = async () => {
        if (!formData.title.trim()) {
            toast({ title: 'Title is required', description: 'Please enter a title first.', variant: 'destructive' });
            return;
        }
        setIsGeneratingDesc(true);
        try {
            const res = await chatApi.generateDescription(formData.title);
            if (res.description) {
                setFormData(prev => ({ ...prev, description: res.description }));
                toast({ title: 'Description generated!' });
            }
        } catch (error) {
            toast({ title: 'Failed to generate description', description: error.message || 'Please try again.', variant: 'destructive' });
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    const handleLocation = async () => {
        setIsFetchingLocation(true);
        try {
            const loc = await getCurrentLocation();
            setLocation(loc);
            const address = await reverseGeocode(loc.latitude, loc.longitude);
            setLocationAddress(address);
            toast({ title: 'Location captured!' });

            // If photo already has EXIF GPS, re-run the mismatch check with new live location
            if (exifGps) {
                runMismatchCheck(exifGps, loc);
            }
        } catch (error) {
            toast({ title: 'Could not get location', description: 'Please enable location services.', variant: 'destructive' });
        }
        setIsFetchingLocation(false);
    };

    const runMismatchCheck = (photoGps, liveGps) => {
        if (!photoGps || !liveGps) return;
        const dist = getDistanceKm(
            photoGps.latitude, photoGps.longitude,
            liveGps.latitude, liveGps.longitude
        );
        setMismatchDistKm(dist.toFixed(2));
        setLocationMismatch(dist > THRESHOLD_KM);
    };

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 800;
                    let { width, height } = img;
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
                        else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageFile(file);

        // Reset EXIF states on new file
        setExifGps(null);
        setLocationMismatch(false);
        setMismatchDistKm(null);
        setNoExifGps(false);

        // Compress for preview/upload
        const compressed = await compressImage(file);
        setImage(compressed);

        // Extract EXIF GPS from the ORIGINAL file (before compression strips metadata)
        try {
            const gps = await exifr.gps(file);
            if (gps && gps.latitude && gps.longitude) {
                setExifGps({ latitude: gps.latitude, longitude: gps.longitude });
                // Compare with live GPS if already captured
                if (location) {
                    runMismatchCheck(
                        { latitude: gps.latitude, longitude: gps.longitude },
                        location
                    );
                }
            } else {
                // Photo has no GPS data — common for screenshots / PC photos
                setNoExifGps(true);
            }
        } catch {
            setNoExifGps(true);
        }
    };

    // Derive overall verification status
    const verificationStatus = () => {
        if (!image) return null; // no photo yet
        if (noExifGps) return 'no_exif';
        if (!exifGps) return 'loading'; // still parsing EXIF
        if (!location) return 'need_location'; // photo has GPS but we haven't captured live GPS yet
        if (!locationMismatch) return 'match';
        if (locationMismatch) return 'mismatch';
        return null;
    };
    const vStatus = verificationStatus();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (vStatus !== 'match') {
            toast({
                title: 'Cannot Submit Report',
                description: 'You must upload a photo with GPS data that matches your current live location.',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const category = categorizeIssue(formData.description, formData.title);
            await complaintsApi.create({
                ...formData,
                image,
                address: locationAddress,
                category,
                latitude: location.latitude,
                longitude: location.longitude,
            });

            toast({ title: 'Issue Reported!', description: 'Thank you for your contribution.' });
            setTimeout(() => navigate('/my-complaints'), 1000);
        } catch (error) {
            toast({
                title: 'Failed to report issue',
                description: error.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <>
            <Helmet>
                <title>Report an Issue - CITIFIX</title>
                <meta name="description" content="Report a new civic issue." />
            </Helmet>
            <DashboardLayout>
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-slate-300 hover:bg-slate-700">
                        <ArrowLeft />
                    </Button>
                    <h1 className="text-3xl font-bold">Report a New Issue</h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800 p-6 sm:p-8 rounded-xl shadow-lg space-y-6 max-w-2xl mx-auto border border-slate-700">

                    {/* Title */}
                    <div>
                        <Label htmlFor="title" className="text-slate-100">Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Large pothole on Main Street"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="bg-slate-700 text-slate-100 border-slate-600 placeholder:text-slate-400"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="description" className="text-slate-100">Description</Label>
                            <Button
                                type="button" variant="outline" size="sm"
                                onClick={handleGenerateDescription}
                                disabled={isGeneratingDesc || !formData.title.trim()}
                                className="h-7 text-xs bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30"
                            >
                                {isGeneratingDesc ? <Loader2 className="animate-spin w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1 text-amber-400" />}
                                ✨ Generate with AI
                            </Button>
                        </div>
                        <textarea
                            id="description" rows="5"
                            className="w-full rounded-md border border-slate-600 p-3 bg-slate-700 text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="Provide more details about the issue..."
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <Label className="text-slate-100">Live Location</Label>
                        <Button
                            type="button" variant="outline"
                            className="w-full flex items-center gap-2 bg-slate-700 text-slate-100 border-slate-600 hover:bg-slate-600"
                            onClick={handleLocation}
                            disabled={isFetchingLocation}
                        >
                            {isFetchingLocation ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                            {locationAddress ? 'Recapture Location' : 'Get Live Location'}
                        </Button>
                        {locationAddress && (
                            <p className="text-sm text-slate-300 mt-2 p-2 bg-slate-700 rounded-md">{locationAddress}</p>
                        )}
                    </div>

                    {/* Upload Image */}
                    <div>
                        <Label className="text-slate-100 mb-2 block">
                            Upload Photo <span className="text-slate-400 text-xs font-normal">(ideally taken on-site with GPS enabled)</span>
                        </Label>
                        <div className="flex gap-3">
                            {/* Option 1: Take Photo (Camera) */}
                            <Label className="flex-1 cursor-pointer">
                                <div className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all">
                                    <Camera className="w-6 h-6 text-amber-400" />
                                    <span className="text-sm font-medium">Take Photo</span>
                                </div>
                                <input
                                    type="file" accept="image/*" capture="environment"
                                    onChange={handleImageChange} className="hidden"
                                />
                            </Label>

                            {/* Option 2: Choose File (Gallery) */}
                            <Label className="flex-1 cursor-pointer">
                                <div className="bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all">
                                    <Upload className="w-6 h-6 text-indigo-400" />
                                    <span className="text-sm font-medium">Upload File</span>
                                </div>
                                <input
                                    type="file" accept="image/*"
                                    onChange={handleImageChange} className="hidden"
                                />
                            </Label>
                        </div>
                        {image && <img src={image} alt="Preview" className="mt-4 rounded-md max-h-48 w-full object-cover shadow-md border border-slate-600" />}
                    </div>

                    {/* ── EXIF / Location Verification Panel ── */}
                    {vStatus && (
                        <div className={`rounded-xl border p-4 space-y-2 ${
                            vStatus === 'loading'        ? 'bg-slate-700/50  border-slate-600'     :
                            vStatus === 'match'          ? 'bg-emerald-500/10 border-emerald-500/30' :
                            vStatus === 'mismatch'       ? 'bg-rose-500/10   border-rose-500/30'   :
                            vStatus === 'no_exif'        ? 'bg-blue-500/10   border-blue-500/30'   :
                            /* need_location */            'bg-slate-700/50   border-slate-600'
                        }`}>

                            {/* LOADING EXIF */}
                            {vStatus === 'loading' && (
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                                    <div>
                                        <p className="text-sm font-bold">Analyzing Photo...</p>
                                        <p className="text-xs text-slate-400">Checking for embedded GPS location data.</p>
                                    </div>
                                </div>
                            )}

                            {/* MATCH */}
                            {vStatus === 'match' && exifGps && (
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold">Location Verified ✓</p>
                                        <p className="text-xs text-emerald-300/70">
                                            Photo GPS ({exifGps.latitude.toFixed(4)}, {exifGps.longitude.toFixed(4)}) matches your live location ({mismatchDistKm} km apart).
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* MISMATCH */}
                            {vStatus === 'mismatch' && exifGps && (
                                <div className="flex items-start gap-2 text-rose-400">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold">Location Mismatch Detected</p>
                                        <p className="text-xs text-rose-300/70">
                                            Your photo's GPS ({exifGps.latitude.toFixed(4)}, {exifGps.longitude.toFixed(4)}) is <strong>{mismatchDistKm} km</strong> away from your current location.
                                            You must report issues from the actual location.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* NO EXIF GPS */}
                            {vStatus === 'no_exif' && (
                                <div className="flex items-start gap-2 text-blue-400">
                                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold">No GPS Data in Photo</p>
                                        <p className="text-xs text-blue-300/70">
                                            Your photo doesn't contain embedded GPS metadata (common for screenshots, WhatsApp downloads, or photos taken with GPS disabled).
                                            We'll use your <strong>live location</strong> to verify the report location instead.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* HAS EXIF — WAITING FOR LIVE GPS */}
                            {vStatus === 'need_location' && exifGps && (
                                <div className="flex items-start gap-2 text-slate-400">
                                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-400" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-300">Photo GPS Found — Capture Live Location to Verify</p>
                                        <p className="text-xs text-slate-400">
                                            Photo GPS: {exifGps.latitude.toFixed(4)}, {exifGps.longitude.toFixed(4)}.
                                            Click "Get Live Location" above to compare it with your current position.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        className="w-full gradient-saffron text-white"
                        disabled={isSubmitting || vStatus !== 'match'}
                    >
                        {isSubmitting
                            ? <><Loader2 className="animate-spin w-4 h-4 mr-2" /> Submitting...</>
                            : vStatus === 'mismatch'
                            ? '⚠️ Location Mismatch (Cannot Submit)'
                            : vStatus === 'no_exif'
                            ? '⚠️ No GPS Data in Photo (Cannot Submit)'
                            : vStatus === 'need_location'
                            ? '⚠️ Capture Live Location First'
                            : !image
                            ? '⚠️ Upload a Photo First'
                            : <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit Report</>
                        }
                    </Button>
                </form>
            </DashboardLayout>
        </>
    );
};

export default ReportIssue;
