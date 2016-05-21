package geocode.mygeo;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileInputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.Writer;

import geocode.kdtree.*;
import geocode.*;
import geocode.ReverseGeoCode;

public class GeoFinder {
	public static void main(String args[]){
		try{
		ReverseGeoCode reverseGeoCode = new ReverseGeoCode(new FileInputStream("/Users/Shreyams/Downloads/cities15000.txt"), true);

	//	System.out.println("Nearest to 33.874506, -118.289312 is " + reverseGeoCode.nearestPlace(33.874506, -118.289312));
		BufferedReader br = new BufferedReader(new FileReader("/Users/Shreyams/Downloads/leading.csv")); 
		Writer wr = new BufferedWriter(new FileWriter("/Users/Shreyams/Desktop/locations/locationOutput1.txt", true));
		for(String line; (line = br.readLine()) != null; ) {
		        // process the line.
		    	String eachline[] = line.split(",");
		    	if(eachline.length>4){
		    	String str = eachline[4].replace("\"", "").replace("(", "");
		    	String strCopy = eachline[4].replace("\"", "").replace("(", "").replace("-", "");

		    	String str1 = eachline[5].replace("\"",  "").replace(")", "");
		    	String str1Copy = eachline[5].replace("\"",  "").replace(")", "").replace("-", "");
		    	
		    	Double lat;
		    	if(str.contains("-")){
		    		lat = Double.parseDouble(strCopy)*(-1);
				}
				else{
					lat = Double.parseDouble(strCopy);
				}
		    	Double lon;
		    	if(str1.contains("-")){
		    		lon = Double.parseDouble(str1Copy)*(-1);
		    	//	System.out.println("negative" + lon);
		    	}
		    	else{
		    		lon = Double.parseDouble(str1Copy);
		    	}
		    	/*
		    	System.out.println(str);
		    	String coordinates[] = str.split(",");
		    	Double lat = Double.parseDouble(coordinates[0]);
		    	Double lon = Double.parseDouble(coordinates[1]);
		    	*/
		    	//reverseGeoCode.nearestPlace(lat, lon);
		    	System.out.println(reverseGeoCode.nearestPlace(lat, lon));
		    	System.out.println(lat + " " + lon);
		    	wr.append(eachline[0]+","+eachline[1]+","+eachline[2]+","+eachline[3]+","+reverseGeoCode.nearestPlace(lat, lon)+"\n");
		    	}
		    }
		
		} catch(Exception e){
			e.printStackTrace();
		}
	}
}
